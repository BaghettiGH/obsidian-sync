const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore();

const DEVICE_TOKEN = process.env.DEVICE_TOKEN;

/**
 * POST /getChanges
 * body: { deviceId: string, since: string (ISO timestamp, optional) }
 * header: Authorization: Bearer <DEVICE_TOKEN>
 *
 * Returns all file records modified after `since`. If `since` is omitted,
 * looks up the device's own lastSyncedAt from Firestore (first-sync case:
 * device has never synced, so lastSyncedAt is absent -> returns everything).
 *
 * Does NOT update devices/{deviceId}.lastSyncedAt here — that's the
 * device's job to update only after it has successfully applied the
 * changes locally. If we set it here and the device crashes mid-apply,
 * it would lose those changes forever on next sync.
 */
functions.http('getChanges', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(204).send('');
    }

    const authHeader = req.get('Authorization') || '';
    if (authHeader !== `Bearer ${DEVICE_TOKEN}`) {
        return res.status(401).json({ error: 'unauthorized' });
    }

    const { deviceId, since } = req.body || {};
    if (!deviceId) {
        return res.status(400).json({ error: 'deviceId is required' });
    }

    try {
        let sinceTimestamp;

        if (since) {
            sinceTimestamp = new Date(since);
            if (isNaN(sinceTimestamp.getTime())) {
                return res.status(400).json({ error: 'since must be a valid ISO timestamp' });
            }
        } else {
            // Fall back to this device's last recorded sync time
            const deviceDoc = await firestore.collection('devices').doc(deviceId).get();
            sinceTimestamp = deviceDoc.exists && deviceDoc.data().lastSyncedAt
                ? deviceDoc.data().lastSyncedAt.toDate()
                : new Date(0); // epoch — device has never synced, return everything
        }

        const snapshot = await firestore
            .collection('files')
            .where('lastModified', '>', sinceTimestamp)
            .orderBy('lastModified', 'asc')
            .get();

        const changes = snapshot.docs.map((doc) => {
            const d = doc.data();
            return {
                path: d.path,
                hash: d.hash,
                version: d.version,
                lastModified: d.lastModified.toDate().toISOString(),
                lastModifiedBy: d.lastModifiedBy,
                deleted: d.deleted,
                gcsObjectPath: d.gcsObjectPath,
            };
        });

        // Exclude changes that this same device made — no point pulling down
        // your own writes as if they were remote changes.
        const filtered = changes.filter((c) => c.lastModifiedBy !== deviceId);

        return res.status(200).json({
            changes: filtered,
            serverTime: new Date().toISOString(), // client should save this as its new "since" cursor
        });
    } catch (err) {
        console.error('getChanges error:', err);
        return res.status(500).json({ error: 'internal error' });
    }
});
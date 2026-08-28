const functions = require('@google-cloud/functions-framework');
const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');

const storage = new Storage();
const firestore = new Firestore();

const BUCKET_NAME = process.env.BUCKET_NAME;
const DEVICE_TOKEN = process.env.DEVICE_TOKEN;

/**
 * POST /deleteFile
 * body: { path: string, deviceId: string }
 * header: Authorization: Bearer <DEVICE_TOKEN>
 *
 * Marks the file as deleted in Firestore (tombstone) so other devices
 * find out via getChanges and can delete their local copy too. Does NOT
 * delete the GCS object here — that happens later via a separate cleanup
 * step, after the tombstone has had time to propagate. Deleting the
 * object immediately would break in-flight getDownloadUrl calls from
 * other devices that saw the file in a getChanges response moments ago.
 */
functions.http('deleteFile', async (req, res) => {
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

    const { path, deviceId } = req.body || {};
    if (!path || !deviceId) {
        return res.status(400).json({ error: 'path and deviceId are required' });
    }

    try {
        const fileId = encodePath(path);
        const fileRef = firestore.collection('files').doc(fileId);

        const doc = await fileRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'file not found in index' });
        }

        const prevVersion = doc.data().version || 0;

        await fileRef.set({
            path,
            hash: null,
            lastModified: Firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: deviceId,
            version: prevVersion + 1,
            deleted: true,
            gcsObjectPath: doc.data().gcsObjectPath,
        });

        await firestore.collection('devices').doc(deviceId).set(
            { lastSyncedAt: Firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );

        return res.status(200).json({ tombstoned: true, path });
    } catch (err) {
        console.error('deleteFile error:', err);
        return res.status(500).json({ error: 'internal error' });
    }
});

function encodePath(path) {
    return Buffer.from(path).toString('base64url');
}
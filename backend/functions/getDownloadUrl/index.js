const functions = require('@google-cloud/functions-framework');
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();

const BUCKET_NAME = process.env.BUCKET_NAME;
const DEVICE_TOKEN = process.env.DEVICE_TOKEN;

/**
 * POST /getDownloadUrl
 * body: { path: string }
 * header: Authorization: Bearer <DEVICE_TOKEN>
 *
 * Returns a short-lived signed URL the device can GET the file bytes from
 * directly (no proxying through the function, same reasoning as upload).
 */
functions.http('getDownloadUrl', async (req, res) => {
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

    const { path } = req.body || {};
    if (!path) {
        return res.status(400).json({ error: 'path is required' });
    }

    try {
        const objectPath = `vault/${path}`;
        const file = storage.bucket(BUCKET_NAME).file(objectPath);

        const [exists] = await file.exists();
        if (!exists) {
            return res.status(404).json({ error: 'file not found', objectPath });
        }

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 min
        });

        return res.status(200).json({ downloadUrl: url, objectPath });
    } catch (err) {
        console.error('getDownloadUrl error:', err);
        return res.status(500).json({ error: 'internal error' });
    }
});
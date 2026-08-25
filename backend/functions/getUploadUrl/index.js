const functions = require('@google-cloud/functions-framework');
const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');

const storage = new Storage();
const firestore = new Firestore();

const BUCKET_NAME = process.env.BUCKET_NAME;
const DEVICE_TOKEN = process.env.DEVICE_TOKEN;

functions.http('getUploadUrl', async (req, res) => {
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

    const { path, hash, deviceId } = req.body || {};
    if (!path || !hash || !deviceId) {
        return res.status(400).json({ error: 'path, hash, and deviceId are required' });
    }

    try {
        const fileDoc = await firestore.collection('files').doc(encodePath(path)).get();
        if (fileDoc.exists && fileDoc.data().hash === hash) {
            return res.status(200).json({ noop: true, reason: 'hash unchanged' });
        }

        const objectPath = `vault/${path}`;
        const file = storage.bucket(BUCKET_NAME).file(objectPath);

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000,
            contentType: 'application/octet-stream',
            extensionHeaders: {
                'x-goog-meta-path': path,
                'x-goog-meta-hash': hash,
                'x-goog-meta-device-id': deviceId,
            },
        });

        return res.status(200).json({ uploadUrl: url, objectPath });
    } catch (err) {
        console.error('getUploadUrl error:', err);
        return res.status(500).json({ error: 'internal error' });
    }
});

function encodePath(path) {
    return Buffer.from(path).toString('base64url');
}
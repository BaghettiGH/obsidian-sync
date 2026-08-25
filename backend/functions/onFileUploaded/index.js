const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore();

/**
 * CloudEvent triggered by google.cloud.storage.object.v1.finalized
 * (fires on new object creation AND on overwrite of an existing object).
 *
 * Reads the x-goog-meta-* custom metadata that getUploadUrl signed into
 * the upload, and writes/updates the corresponding Firestore doc.
 */
functions.cloudEvent('onFileUploaded', async (cloudEvent) => {
    const data = cloudEvent.data;

    const objectName = data.name; // e.g. "vault/notes/test.md"
    const metadata = data.metadata || {};

    const path = metadata['path'];
    const hash = metadata['hash'];
    const deviceId = metadata['device-id'];

    if (!path || !hash || !deviceId) {
        console.error('Missing required metadata on object:', objectName, metadata);
        return; // don't throw — no point retrying a permanently malformed object
    }

    const fileId = encodePath(path);
    const fileRef = firestore.collection('files').doc(fileId);

    await firestore.runTransaction(async (tx) => {
        const doc = await tx.get(fileRef);
        const prevVersion = doc.exists ? (doc.data().version || 0) : 0;

        tx.set(fileRef, {
            path,
            hash,
            lastModified: Firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: deviceId,
            version: prevVersion + 1,
            deleted: false,
            gcsObjectPath: objectName,
        });
    });

    // Keep devices/{deviceId}.lastSyncedAt fresh too — cheap and useful for
    // debugging ("when did this device last push anything").
    await firestore.collection('devices').doc(deviceId).set(
        { lastSyncedAt: Firestore.FieldValue.serverTimestamp() },
        { merge: true }
    );

    console.log(`Synced metadata for ${path} (device: ${deviceId})`);
});

function encodePath(path) {
    return Buffer.from(path).toString('base64url');
}
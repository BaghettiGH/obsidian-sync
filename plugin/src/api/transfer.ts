import type { ObsidianSyncSettings } from '../types';

/**
 * Raw calls to GCS signed URLs — deliberately separate from httpClient.ts
 * since these never carry your backend's bearer token (the signed URL
 * itself IS the auth) and use different headers entirely.
 */

export async function uploadToSignedUrl(
	settings: ObsidianSyncSettings,
	uploadUrl: string,
	content: ArrayBuffer,
	path: string,
	hash: string
): Promise<void> {
	const res = await fetch(uploadUrl, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/octet-stream',
			'x-goog-meta-path': path,
			'x-goog-meta-hash': hash,
			'x-goog-meta-device-id': settings.deviceId,
		},
		body: content,
	});
	if (!res.ok) {
		throw new Error(`upload failed: ${res.status} ${await res.text()}`);
	}
}

export async function downloadFromSignedUrl(downloadUrl: string): Promise<ArrayBuffer> {
	const res = await fetch(downloadUrl);
	if (!res.ok) {
		throw new Error(`download failed: ${res.status} ${await res.text()}`);
	}
	return res.arrayBuffer();
}
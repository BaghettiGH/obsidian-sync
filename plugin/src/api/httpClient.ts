import type { ObsidianSyncSettings } from '../types';

/**
 * Low-level fetch wrapper for calls to your own backend (getUploadUrl,
 * getChanges, etc.) — always attaches auth headers, always throws on
 * non-2xx. Does NOT handle calls to signed GCS URLs (those need different
 * headers and no bearer token) — see transfer.ts for those.
 */
export class HttpClient {
	constructor(private settings: ObsidianSyncSettings) {}

	async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
		const res = await fetch(`${this.settings.backendUrl}${endpoint}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.settings.deviceToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			throw new Error(`${endpoint} failed: ${res.status} ${await res.text()}`);
		}

		return res.json();
	}
}
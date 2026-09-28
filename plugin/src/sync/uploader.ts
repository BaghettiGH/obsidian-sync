import { Vault } from 'obsidian';
import { SyncApiClient } from '../api';
import { hashContent } from './hasher';
import type { ConflictResolver } from './conflictResolver';
import type { ObsidianSyncSettings } from '../types';

/**
 * Performs one upload attempt for one path: read -> hash -> ask backend
 * -> PUT bytes -> record the new version. Knows nothing about debouncing
 * or scheduling; that's uploadScheduler's job.
 */
export class Uploader {
	constructor(
		private vault: Vault,
		private api: SyncApiClient,
		private settings: ObsidianSyncSettings,
		private saveSettings: () => Promise<void>,
		private conflicts: ConflictResolver
	) {}

	async upload(path: string): Promise<void> {
		const file = this.vault.getFileByPath(path);
		if (!file) {
			// Deleted again before the debounce fired -- not an error.
			return;
		}

		const content = await this.vault.readBinary(file);
		const hash = await hashContent(content);

		const response = await this.api.getUploadUrl(path, hash);

		if (response.noop) {
			console.log(`obsidian-sync: ${path} unchanged (${response.reason})`);
			return;
		}

		if (response.conflict) {
			await this.conflicts.resolve(path, content, response);
			return;
		}

		if (!response.uploadUrl) {
			throw new Error(`getUploadUrl returned no uploadUrl for ${path}`);
		}

		await this.api.uploadToSignedUrl(response.uploadUrl, content, path, hash);

		const priorVersion = this.settings.fileVersions[path] ?? 0;
		this.settings.fileVersions[path] = priorVersion + 1;
		await this.saveSettings();

		console.log(`obsidian-sync: uploaded ${path}`);
	}
}
import { Vault } from 'obsidian';
import { SyncApiClient } from '../api';
import type { GetUploadUrlResponse } from '../api/types';
import type { FileWatcher } from './fileWatcher';
import type { ObsidianSyncSettings } from '../types';

/**
 * Handles the case where getUploadUrl reports a 409: someone else's edit
 * landed first. The server's version wins locally, and the local edit is
 * preserved as a separate conflict-copy file so nothing is lost.
 */
export class ConflictResolver {
	constructor(
		private vault: Vault,
		private api: SyncApiClient,
		private watcher: FileWatcher,
		private settings: ObsidianSyncSettings,
		private saveSettings: () => Promise<void>
	) {}

	async resolve(
		path: string,
		localContent: ArrayBuffer,
		response: Pick<GetUploadUrlResponse, 'currentVersion' | 'currentModifiedBy'>
	): Promise<void> {
		console.warn(
			`obsidian-sync: conflict on ${path} (last modified by ${response.currentModifiedBy})`
		);

		const { downloadUrl } = await this.api.getDownloadUrl(path);
		const remoteContent = await this.api.downloadFromSignedUrl(downloadUrl);

		const conflictPath = buildConflictCopyPath(path, this.settings.deviceId);

		// Preserve the local edit under a new name.
		this.watcher.suppressNextEvent(conflictPath);
		await this.vault.createBinary(conflictPath, localContent);

		// Make the original path match the server's winning version.
		const file = this.vault.getFileByPath(path);
		if (file) {
			this.watcher.suppressNextEvent(path);
			await this.vault.modifyBinary(file, remoteContent);
		}

		if (response.currentVersion !== undefined) {
			this.settings.fileVersions[path] = response.currentVersion;
		}
		await this.saveSettings();

		console.warn(
			`obsidian-sync: conflict resolved -- your edit saved as ${conflictPath}, ` +
				`${path} now matches the server`
		);
	}
}

function buildConflictCopyPath(path: string, deviceId: string): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const dotIndex = path.lastIndexOf('.');
	const ext = dotIndex !== -1 ? path.slice(dotIndex) : '';
	const base = dotIndex !== -1 ? path.slice(0, dotIndex) : path;
	return `${base} (conflict copy, ${deviceId}, ${timestamp})${ext}`;
}
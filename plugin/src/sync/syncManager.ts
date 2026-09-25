import { Vault } from 'obsidian';
import { SyncApiClient } from '../api';
import { hashContent } from './hasher';
import type { FileChangeEvent } from './fileWatcher';
import type { FileWatcher }	from './fileWatcher';
import type { ObsidianSyncSettings } from '../types';

/**
 * Orchestrates the push side of sync: file change event -> hash -> upload.
 * Debounces per-path so rapid edits (e.g. typing) don't trigger an upload
 * per keystroke -- we wait for a quiet period before syncing.
 */
export class SyncManager {
	private vault: Vault;
	private api: SyncApiClient;
	private watcher: FileWatcher;
	private settings: ObsidianSyncSettings;
	private saveSettings: () => Promise<void>;
	private debounceMs: number;
	private pendingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

	constructor(
		vault: Vault,
		api: SyncApiClient,
		watcher: FileWatcher,
		settings: ObsidianSyncSettings,
		saveSettings: () => Promise<void>,
		debounceMs = 2000
	) {
		this.vault = vault;
		this.api = api;
		this.watcher = watcher;
		this.settings = settings;
		this.saveSettings = saveSettings;
		this.debounceMs = debounceMs;
	}

	handleEvent(event: FileChangeEvent): void {
		if (event.type === 'delete') {
			// Deletes are rare and deliberate -- no need to debounce, act immediately.
			this.handleDelete(event.path);
			return;
		}

		if (event.type === 'rename') {
			// v1: treat a rename as delete-old + create-new. Simple and correct,
			// though it means a full re-upload instead of a cheap rename op.
			// Revisit if renames turn out to be frequent enough to matter.
			if (event.oldPath) {
				this.handleDelete(event.oldPath);
			}
			this.scheduleUpload(event.path);
			return;
		}

		// 'create' or 'modify' -- debounce, since these can fire rapidly.
		this.scheduleUpload(event.path);
	}

	private scheduleUpload(path: string): void {
		const existing = this.pendingTimers.get(path);
		if (existing) {
			clearTimeout(existing);
		}

		const timer = setTimeout(() => {
			this.pendingTimers.delete(path);
			this.uploadFile(path).catch((err) => {
				console.error(`obsidian-sync: upload failed for ${path}`, err);
			});
		}, this.debounceMs);

		this.pendingTimers.set(path, timer);
	}

	private async uploadFile(path: string): Promise<void> {
		const file = this.vault.getFileByPath(path);
		if (!file) {
			// File may have been deleted again before the debounce fired --
			// nothing to upload, this isn't an error.
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
			await this.handleConflict(path, content, response);
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
	private async handleConflict(
		path: string,
		localContent: ArrayBuffer,
		response: { currentVersion?: number; currentModifiedBy?: string }
	): Promise<void> {
		console.warn(
			`obsidian-sync: conflict on ${path} (last modified by ${response.currentModifiedBy})`
		);

		// Pull down the version that won the race.
		const { downloadUrl } = await this.api.getDownloadUrl(path);
		const remoteContent = await this.api.downloadFromSignedUrl(downloadUrl);

		const conflictPath = buildConflictCopyPath(path, this.settings.deviceId);

		// Save our local edit under a new name so nothing is lost.
		this.watcher.suppressNextEvent(conflictPath);
		await this.vault.createBinary(conflictPath, localContent);

		// Overwrite the local file with the version that actually won,
		// so the vault matches the server's source of truth.
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

	private async handleDelete(path: string): Promise<void> {
		const existing = this.pendingTimers.get(path);
		if (existing) {
			clearTimeout(existing);
			this.pendingTimers.delete(path);
		}

		try {
			await this.api.deleteFile(path);
			delete this.settings.fileVersions[path];
			await this.saveSettings();
			console.log(`obsidian-sync: tombstoned ${path}`);
		} catch (err) {
			console.error(`obsidian-sync: delete failed for ${path}`, err);
		}
	}

}

function buildConflictCopyPath(path: string, deviceId: string): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const dotIndex = path.lastIndexOf('.');
	const ext = dotIndex !== -1 ? path.slice(dotIndex) : '';
	const base = dotIndex !== -1 ? path.slice(0, dotIndex) : path;
	return `${base} (conflict copy, ${deviceId}, ${timestamp})${ext}`;
}
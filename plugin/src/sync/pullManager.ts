import { Vault, normalizePath } from 'obsidian';
import { SyncApiClient } from '../api';
import type { FileWatcher } from './fileWatcher';
import type { ObsidianSyncSettings } from '../types';

/**
 * Handles the pull side of sync: ask the backend what changed, download
 * and apply those changes locally. Counterpart to syncManager.ts (push).
 */
export class PullManager {
	private vault: Vault;
	private api: SyncApiClient;
	private watcher: FileWatcher;
	private settings: ObsidianSyncSettings;
	private saveSettings: () => Promise<void>;

	constructor(
		vault: Vault,
		api: SyncApiClient,
		watcher: FileWatcher,
		settings: ObsidianSyncSettings,
		saveSettings: () => Promise<void>
	) {
		this.vault = vault;
		this.api = api;
		this.watcher = watcher;
		this.settings = settings;
		this.saveSettings = saveSettings;
	}

	async pull(): Promise<void> {
		const response = await this.api.getChanges(this.settings.lastSyncedAt ?? undefined);

		if (response.changes.length === 0) {
			// Still advance the cursor -- no changes doesn't mean "don't update
			// serverTime", otherwise a slow clock drift could cause re-querying
			// the same empty range forever. Harmless either way, but tidier.
			this.settings.lastSyncedAt = response.serverTime;
			await this.saveSettings();
			return;
		}

		for (const change of response.changes) {
			try {
				if (change.deleted) {
					await this.applyDelete(change.path);
				} else {
					await this.applyChange(change.path, change.version);
				}
			} catch (err) {
				console.error(`obsidian-sync: failed to apply change for ${change.path}`, err);
				// Continue with remaining changes rather than aborting the whole
				// pull -- one bad file shouldn't block everything else syncing.
			}
		}

		this.settings.lastSyncedAt = response.serverTime;
		await this.saveSettings();
	}

	private async applyChange(path: string, version: number): Promise<void> {
		const { downloadUrl } = await this.api.getDownloadUrl(path);
		const content = await this.api.downloadFromSignedUrl(downloadUrl);

		const normalizedPath = normalizePath(path);
		const existing = this.vault.getFileByPath(normalizedPath);

		this.watcher.suppressNextEvent(normalizedPath);

		if (existing) {
			await this.vault.modifyBinary(existing, content);
		} else {
			await this.ensureParentFolders(normalizedPath);
			await this.vault.createBinary(normalizedPath, content);
		}

		this.settings.fileVersions[normalizedPath] = version;
		await this.saveSettings();

		console.log(`obsidian-sync: pulled ${normalizedPath}`);
	}

	private async applyDelete(path: string): Promise<void> {
		const normalizedPath = normalizePath(path);
		const existing = this.vault.getFileByPath(normalizedPath);

		if (existing) {
			this.watcher.suppressNextEvent(normalizedPath);
			await this.vault.delete(existing);
			console.log(`obsidian-sync: deleted locally ${normalizedPath}`);
		}
		// If it doesn't exist locally, nothing to do -- already in sync.
	}

	private async ensureParentFolders(path: string): Promise<void> {
		const parts = path.split('/');
		parts.pop(); // remove filename
		if (parts.length === 0) return;

		const folderPath = parts.join('/');
		const existing = this.vault.getFolderByPath(folderPath);
		if (!existing) {
			await this.vault.createFolder(folderPath);
		}
	}
}
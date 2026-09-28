import { Vault } from 'obsidian';
import { SyncApiClient } from '../api';
import { ConflictResolver } from './conflictResolver';
import { Uploader } from './uploader';
import { UploadScheduler } from './uploadScheduler';
import type { FileChangeEvent, FileWatcher } from './fileWatcher';
import type { ObsidianSyncSettings } from '../types';

/**
 * Orchestrates the push side of sync. Routes file events to the right
 * place; the actual work lives in uploader / conflictResolver /
 * uploadScheduler.
 */
export class SyncManager {
	private scheduler: UploadScheduler;

	constructor(
		vault: Vault,
		private api: SyncApiClient,
		watcher: FileWatcher,
		private settings: ObsidianSyncSettings,
		private saveSettings: () => Promise<void>,
		debounceMs = 2000
	) {
		const conflicts = new ConflictResolver(vault, api, watcher, settings, saveSettings);
		const uploader = new Uploader(vault, api, settings, saveSettings, conflicts);
		this.scheduler = new UploadScheduler(debounceMs, (path) => uploader.upload(path));
	}

	handleEvent(event: FileChangeEvent): void {
		switch (event.type) {
			case 'delete':
				this.handleDelete(event.path);
				break;

			case 'rename':
				// v1: rename = delete old + upload new.
				if (event.oldPath) {
					this.handleDelete(event.oldPath);
				}
				this.scheduler.schedule(event.path);
				break;

			case 'create':
			case 'modify':
				this.scheduler.schedule(event.path);
				break;
		}
	}

	private async handleDelete(path: string): Promise<void> {
		this.scheduler.cancel(path);

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
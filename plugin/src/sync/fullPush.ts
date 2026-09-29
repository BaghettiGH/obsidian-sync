import { Vault } from 'obsidian';
import type { SyncManager } from './syncManager';
import type { ObsidianSyncSettings } from '../types';

/**
 * Manual "push everything that changed" pass. Used where background file
 * watching isn't reliable (mobile), and as a catch-up after being offline.
 *
 * - Uploads files whose mtime is newer than the last push. Files that
 *   haven't really changed are cheap: the backend answers `noop` when
 *   the hash matches.
 * - Tombstones files we previously synced that no longer exist locally.
 */
export class FullPush {
	constructor(
		private vault: Vault,
		private sync: SyncManager,
		private settings: ObsidianSyncSettings,
		private saveSettings: () => Promise<void>
	) {}

	async run(): Promise<{ scanned: number; failed: number; deleted: number }> {
		const startedAt = Date.now();
		const since = this.settings.lastPushAt ?? 0;
		const files = this.vault.getFiles();

		let failed = 0;
		for (const file of files) {
			if (file.stat.mtime <= since) continue;
			try {
				await this.sync.uploadNow(file.path);
			} catch (err) {
				failed++;
				console.error(`obsidian-sync: push failed for ${file.path}`, err);
			}
		}

		// Files we know about but that are gone locally were deleted offline.
		const localPaths = new Set(files.map((f) => f.path));
		let deleted = 0;
		for (const path of Object.keys(this.settings.fileVersions)) {
			if (!localPaths.has(path)) {
				await this.sync.deleteNow(path);
				deleted++;
			}
		}

		// Only advance the cursor if everything succeeded, so failed files
		// get retried on the next sync instead of being skipped forever.
		if (failed === 0) {
			this.settings.lastPushAt = startedAt;
			await this.saveSettings();
		}

		return { scanned: files.length, failed, deleted };
	}
}
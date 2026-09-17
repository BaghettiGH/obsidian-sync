import { Vault } from 'obsidian';
import { SyncApiClient } from '../api';
import { hashContent } from './hasher';
import type { FileChangeEvent } from './fileWatcher';

/**
 * Orchestrates the push side of sync: file change event -> hash -> upload.
 * Debounces per-path so rapid edits (e.g. typing) don't trigger an upload
 * per keystroke -- we wait for a quiet period before syncing.
 */
export class SyncManager {
	private vault: Vault;
	private api: SyncApiClient;
	private debounceMs: number;
	private pendingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

	constructor(vault: Vault, api: SyncApiClient, debounceMs = 2000) {
		this.vault = vault;
		this.api = api;
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

		const uploadUrlResponse = await this.api.getUploadUrl(path, hash);

		if (uploadUrlResponse.noop) {
			console.log(`obsidian-sync: ${path} unchanged (${uploadUrlResponse.reason})`);
			return;
		}

		if (!uploadUrlResponse.uploadUrl) {
			throw new Error(`getUploadUrl returned no uploadUrl for ${path}`);
		}

		await this.api.uploadToSignedUrl(uploadUrlResponse.uploadUrl, content, path, hash);
		console.log(`obsidian-sync: uploaded ${path}`);
	}

	private async handleDelete(path: string): Promise<void> {
		const existing = this.pendingTimers.get(path);
		if (existing) {
			clearTimeout(existing);
			this.pendingTimers.delete(path);
		}

		try {
			await this.api.deleteFile(path);
			console.log(`obsidian-sync: tombstoned ${path}`);
		} catch (err) {
			console.error(`obsidian-sync: delete failed for ${path}`, err);
		}
	}
}
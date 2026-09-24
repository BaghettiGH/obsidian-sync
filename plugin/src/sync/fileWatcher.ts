import { TAbstractFile, TFile, Vault } from 'obsidian';

export type FileChangeType = 'modify' | 'create' | 'delete' | 'rename';

export interface FileChangeEvent {
	type: FileChangeType;
	path: string;
	oldPath?: string; // only set for 'rename'
	file?: TFile; // undefined for 'delete'
}

/**
 * Wraps Obsidian's vault events into a single callback interface, filtered
 * to real files only (Obsidian also fires these for folders, which we
 * don't care about for sync purposes).
 *
 * Deliberately does NOT do any hashing, API calls, or debouncing here —
 * this file's only job is "detect that something happened." Deciding what
 * to do about it (hash, compare, upload) belongs in syncManager.ts, so
 * this stays easy to test/reason about in isolation.
 */
export class FileWatcher {
	private vault: Vault;
	private onChange: (event: FileChangeEvent) => void;
	private suppressed: Set<string> = new Set();

	constructor(vault: Vault, onChange: (event: FileChangeEvent) => void) {
		this.vault = vault;
		this.onChange = onChange;
	}

	/**
	 * Marks a path to be ignored for its next single vault event. Used by
	 * the pull path: writing a downloaded file locally fires 'modify'/
	 * 'create' just like a real edit would, and without this we'd try to
	 * re-upload a file we just downloaded.
	 */
	suppressNextEvent(path: string): void {
		this.suppressed.add(path);
	}

	private isSuppressed(path: string): boolean {
		if (this.suppressed.has(path)) {
			this.suppressed.delete(path); // one-shot -- only skip the next event
			return true;
		}
		return false;
	}


	register(registerEvent: (eventRef: any) => void): void {
		registerEvent(
			this.vault.on('modify', (file: TAbstractFile) => {
				if (file instanceof TFile && !this.isSuppressed(file.path)) {
					this.onChange({ type: 'modify', path: file.path, file });
				}
			})
		);

		registerEvent(
			this.vault.on('create', (file: TAbstractFile) => {
				if (file instanceof TFile && !this.isSuppressed(file.path)) {
					this.onChange({ type: 'create', path: file.path, file });
				}
			})
		);

		registerEvent(
			this.vault.on('delete', (file: TAbstractFile) => {
				if (file instanceof TFile && !this.isSuppressed(file.path)) {
					this.onChange({ type: 'delete', path: file.path });
				}
			})
		);

		registerEvent(
			this.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
				if (file instanceof TFile && !this.isSuppressed(file.path)) {
					this.onChange({ type: 'rename', path: file.path, oldPath, file });
				}
			})
		);
	}
}
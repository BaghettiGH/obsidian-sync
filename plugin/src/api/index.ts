import type { ObsidianSyncSettings } from '../types';
import { HttpClient } from './httpClient';
import { getUploadUrl } from './uploadUrl';
import { getDownloadUrl } from './downloadUrl';
import { getChanges } from './changes';
import { deleteFile } from './deleteFile';
import { uploadToSignedUrl, downloadFromSignedUrl } from './transfer';

/**
 * Composes all individual endpoint modules into one client so the rest of
 * the plugin (fileWatcher, syncManager) only needs one import.
 */
export class SyncApiClient {
	private http: HttpClient;

	constructor(private settings: ObsidianSyncSettings) {
		this.http = new HttpClient(settings);
	}

	getUploadUrl(path: string, hash: string) {
		return getUploadUrl(this.http, this.settings, path, hash);
	}

	getDownloadUrl(path: string) {
		return getDownloadUrl(this.http, path);
	}

	getChanges(since?: string) {
		return getChanges(this.http, this.settings, since);
	}

	deleteFile(path: string) {
		return deleteFile(this.http, this.settings, path);
	}

	uploadToSignedUrl(uploadUrl: string, content: ArrayBuffer, path: string, hash: string) {
		return uploadToSignedUrl(this.settings, uploadUrl, content, path, hash);
	}

	downloadFromSignedUrl(downloadUrl: string) {
		return downloadFromSignedUrl(downloadUrl);
	}
}
import type { HttpClient } from './httpClient';
import type { DeleteFileResponse } from './types';
import type { ObsidianSyncSettings } from '../types';

export async function deleteFile(
	http: HttpClient,
	settings: ObsidianSyncSettings,
	path: string
): Promise<DeleteFileResponse> {
	return http.post<DeleteFileResponse>('/deleteFile', {
		path,
		deviceId: settings.deviceId,
	});
}
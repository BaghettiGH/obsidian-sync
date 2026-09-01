import type { HttpClient } from './httpClient';
import type { GetUploadUrlResponse } from './types';
import type { ObsidianSyncSettings } from '../types';

export async function getUploadUrl(
	http: HttpClient,
	settings: ObsidianSyncSettings,
	path: string,
	hash: string
): Promise<GetUploadUrlResponse> {
	return http.post<GetUploadUrlResponse>('/getUploadUrl', {
		path,
		hash,
		deviceId: settings.deviceId,
	});
}
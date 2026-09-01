import type { HttpClient } from './httpClient';
import type { GetChangesResponse } from './types';
import type { ObsidianSyncSettings } from '../types';

export async function getChanges(
	http: HttpClient,
	settings: ObsidianSyncSettings,
	since?: string
): Promise<GetChangesResponse> {
	return http.post<GetChangesResponse>('/getChanges', {
		deviceId: settings.deviceId,
		since,
	});
}
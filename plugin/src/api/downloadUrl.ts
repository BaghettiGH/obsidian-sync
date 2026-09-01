import type { HttpClient } from './httpClient';
import type { GetDownloadUrlResponse } from './types';

export async function getDownloadUrl(
	http: HttpClient,
	path: string
): Promise<GetDownloadUrlResponse> {
	return http.post<GetDownloadUrlResponse>('/getDownloadUrl', { path });
}
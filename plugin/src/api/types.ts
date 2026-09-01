export interface GetUploadUrlResponse {
	noop?: boolean;
	reason?: string;
	uploadUrl?: string;
	objectPath?: string;
}

export interface GetDownloadUrlResponse {
	downloadUrl: string;
	objectPath: string;
}

export interface ChangeRecord {
	path: string;
	hash: string | null;
	version: number;
	lastModified: string;
	lastModifiedBy: string;
	deleted: boolean;
	gcsObjectPath: string;
}

export interface GetChangesResponse {
	changes: ChangeRecord[];
	serverTime: string;
}

export interface DeleteFileResponse {
	tombstoned: boolean;
	path: string;
}
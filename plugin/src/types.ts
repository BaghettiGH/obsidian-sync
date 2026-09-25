export interface ObsidianSyncSettings {
    backendUrl: string;
    deviceToken: string;
    deviceId: string;
    lastSyncedAt: string | null;
    fileVersions: Record<string, number>;
}

export const DEFAULT_SETTINGS: ObsidianSyncSettings = {
    backendUrl: '',
    deviceToken: '',
    deviceId: '',
    lastSyncedAt: null,
    fileVersions: {},
};
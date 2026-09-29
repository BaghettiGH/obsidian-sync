export interface ObsidianSyncSettings {
    backendUrl: string;
    deviceToken: string;
    deviceId: string;
    lastSyncedAt: string | null;
    lastPushAt: number | null;
    fileVersions: Record<string, number>;
}

export const DEFAULT_SETTINGS: ObsidianSyncSettings = {
    backendUrl: '',
    deviceToken: '',
    deviceId: '',
    lastSyncedAt: null,
    lastPushAt: null,
    fileVersions: {},
};
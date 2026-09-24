export interface ObsidianSyncSettings {
    backendUrl: string;
    deviceToken: string;
    deviceId: string;
    lastSyncedAt: string | null;
}

export const DEFAULT_SETTINGS: ObsidianSyncSettings = {
    backendUrl: '',
    deviceToken: '',
    deviceId: '',
    lastSyncedAt: null,
};
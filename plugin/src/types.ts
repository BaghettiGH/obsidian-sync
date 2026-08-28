export interface ObsidianSyncSettings {
    backendUrl: string;
    deviceToken: string;
    deviceId: string;
}

export const DEFAULT_SETTINGS: ObsidianSyncSettings = {
    backendUrl: '',
    deviceToken: '',
    deviceId: '',
};
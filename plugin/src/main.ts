import { Plugin } from 'obsidian';
import { ObsidianSyncSettingTab } from './settings';
import { DEFAULT_SETTINGS, ObsidianSyncSettings } from './types';

export default class ObsidianSyncPlugin extends Plugin {
	settings: ObsidianSyncSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ObsidianSyncSettingTab(this.app, this));
		console.log('obsidian-sync: loaded, settings =', {
			backendUrl: this.settings.backendUrl,
			deviceId: this.settings.deviceId,
			deviceToken: this.settings.deviceToken ? '(set)' : '(empty)',
		});
	}

	onunload() {
		console.log('obsidian-sync: unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
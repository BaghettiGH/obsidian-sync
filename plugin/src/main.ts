import { Plugin } from 'obsidian';
import { ObsidianSyncSettingTab } from './settings';
import { DEFAULT_SETTINGS, ObsidianSyncSettings } from './types';
import { FileWatcher, FileChangeEvent } from './sync/fileWatcher';
import { SyncManager } from './sync/syncManager';
import { PullManager } from './sync/pullManager';
import { SyncApiClient } from './api';

const PULL_INTERVAL_MS = 30 * 1000;

export default class ObsidianSyncPlugin extends Plugin {
	settings!: ObsidianSyncSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ObsidianSyncSettingTab(this.app, this));

		const api = new SyncApiClient(this.settings);
		const syncManager = new SyncManager(this.app.vault, api);

		const watcher = new FileWatcher(this.app.vault, (event: FileChangeEvent) => {
			console.log('obsidian-sync: file event', event.type, event.path);
			syncManager.handleEvent(event);
		});
		watcher.register((eventRef) => this.registerEvent(eventRef));

		const pullManager = new PullManager(
			this.app.vault,
			api,
			watcher,
			this.settings,
			() => this.saveSettings()
		);

		pullManager.pull().catch((err) => console.error('obsidian-sync: initial pull failed', err));
		this.registerInterval(
			window.setInterval(() => {
				pullManager.pull().catch((err) => console.error('obsidian-sync: pull failed', err));
			}, PULL_INTERVAL_MS)
		);

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
		await this.saveData(this.settings)
	}
}
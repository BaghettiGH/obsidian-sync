import { Notice, Platform, Plugin } from 'obsidian';
import { ObsidianSyncSettingTab } from './settings';
import { DEFAULT_SETTINGS, ObsidianSyncSettings } from './types';
import { FileWatcher, FileChangeEvent } from './sync/fileWatcher';
import { SyncManager } from './sync/syncManager';
import { PullManager } from './sync/pullManager';
import { SyncApiClient } from './api';
import { FullPush } from './sync/fullPush';

const PULL_INTERVAL_MS = 30 * 1000;

export default class ObsidianSyncPlugin extends Plugin {
	settings!: ObsidianSyncSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ObsidianSyncSettingTab(this.app, this));

		const api = new SyncApiClient(this.settings);
		
		const watcher = new FileWatcher(this.app.vault, (event: FileChangeEvent) => {
			console.log('obsidian-sync: file event', event.type, event.path);
			syncManager.handleEvent(event);
		});
		const syncManager = new SyncManager(this.app.vault, api, watcher, this.settings, () => this.saveSettings());
		watcher.register((eventRef) => this.registerEvent(eventRef));

		const pullManager = new PullManager(
			this.app.vault,
			api,
			watcher,
			this.settings,
			() => this.saveSettings()
		);

		const fullPush = new FullPush(
			this.app.vault,
			syncManager,
			this.settings,
			() => this.saveSettings()
		);

		let syncing = false;
		const syncNow = async () => {
			if (syncing) return; // don't overlap with a sync already running
			syncing = true;
			new Notice('Syncing…');
			try {
				const result = await fullPush.run(); // push first, so conflicts are detected
				await pullManager.pull();
				new Notice(
					result.failed > 0
						? `Sync finished with ${result.failed} failed file(s), see console`
						: 'Sync complete'
				);
			} catch (err) {
				console.error('obsidian-sync: sync failed', err);
				new Notice('Sync failed, see console');
			} finally {
				syncing = false;
			}
		};

		this.addRibbonIcon('refresh-cw', 'Sync now', syncNow);
		this.addCommand({ id: 'sync-now', name: 'Sync now', callback: syncNow });


		if (Platform.isMobile) {

			this. app.workspace.onLayoutReady(syncNow);
		} else {
			pullManager.pull().catch((err) => console.error('obsidian-sync: initial pull failed', err));
			this.registerInterval(
				window.setInterval(() => {
					pullManager.pull().catch((err) => console.error('obsidian-sync: pull failed', err));
				}, PULL_INTERVAL_MS)
			);
		}

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
import { App, PluginSettingTab, Setting } from 'obsidian';
import type ObsidianSyncPlugin from './main';

export interface MyPluginSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
};

export class ObsidianSyncSettingTab extends PluginSettingTab {
	plugin: ObsidianSyncPlugin;

	constructor(app: App, plugin: ObsidianSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Obsidian Sync settings' });

		new Setting(containerEl)
			.setName('Backend URL')
			.setDesc(
				'Base URL for your Cloud Functions, e.g. https://REGION-PROJECT.cloudfunctions.net (no trailing slash)'
			)
			.addText((text) =>
				text
					.setPlaceholder('https://asia-southeast1-your-project.cloudfunctions.net')
					.setValue(this.plugin.settings.backendUrl)
					.onChange(async (value) => {
						this.plugin.settings.backendUrl = value.trim().replace(/\/$/, '');
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Device token')
			.setDesc('The shared-secret token your backend functions check against.')
			.addText((text) => {
				text
					.setPlaceholder('paste your DEVICE_TOKEN here')
					.setValue(this.plugin.settings.deviceToken)
					.onChange(async (value) => {
						this.plugin.settings.deviceToken = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName('Device ID')
			.setDesc('A unique name for this device, e.g. "desktop-work" or "laptop-home".')
			.addText((text) =>
				text
					.setPlaceholder('desktop-work')
					.setValue(this.plugin.settings.deviceId)
					.onChange(async (value) => {
						this.plugin.settings.deviceId = value.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}

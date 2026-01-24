import { Plugin } from 'obsidian';
import { MapView, getViewOptions } from './map-view';
import { MapSettings, DEFAULT_SETTINGS, MapSettingTab } from './settings';

const HOVER_SOURCE_ID = 'bases-map';

export default class ObsidianMapsPlugin extends Plugin {
	settings: MapSettings;

	async onload() {
		await this.loadSettings();

		this.registerHoverLinkSource(HOVER_SOURCE_ID, {
			display: 'Map',
			defaultMod: false,
		});

		this.registerBasesView('map', {
			name: 'Map',
			icon: 'lucide-map',
			factory: (controller, containerEl) => new MapView(controller, containerEl, this),
			options: () => getViewOptions(),
		});

		this.addSettingTab(new MapSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.settings.tileSets = this.settings.tileSets.map(ts => ({
			...ts,
			coordSystem: ts.coordSystem || 'wgs84'
		}));
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
	}
}

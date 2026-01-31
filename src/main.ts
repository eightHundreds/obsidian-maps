import { Plugin } from 'obsidian';
import { MapView, getViewOptions } from './map-view';
import { MapSettings, DEFAULT_SETTINGS, MapSettingTab } from './settings';
import { initI18n, t } from './i18n';
import { registerCustomPropertyTypes } from './property-types';
const HOVER_SOURCE_ID = 'bases-map';

export default class ObsidianMapsPlugin extends Plugin {
	settings: MapSettings;
	private unregisterPropertyTypes: (() => void) | null = null;

	async onload() {
		await this.loadSettings();
		initI18n();

		this.registerHoverLinkSource(HOVER_SOURCE_ID, {
			display: t('map'),
			defaultMod: false,
		});

		this.registerBasesView('map', {
			name: t('map'),
			icon: 'lucide-map',
			factory: (controller, containerEl) => new MapView(controller, containerEl, this),
			options: () => getViewOptions(),
		});

		this.addSettingTab(new MapSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.unregisterPropertyTypes = registerCustomPropertyTypes(this.app);
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.settings.tileSets = this.settings.tileSets.map((ts) => ({
			...ts,
			coordSystem: ts.coordSystem || 'wgs84',
		}));
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		if (this.unregisterPropertyTypes) {
			this.unregisterPropertyTypes();
			this.unregisterPropertyTypes = null;
		}
	}
}

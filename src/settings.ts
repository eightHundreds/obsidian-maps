import { App, Modal, PluginSettingTab, Setting, setIcon, setTooltip } from 'obsidian';
import ObsidianMapsPlugin from './main';
import { t, Translations } from './i18n';

export type CoordSystem = 'wgs84' | 'gcj02';

export interface TileSet {
	id: string;
	name: string;
	lightTiles: string;
	darkTiles: string;
	coordSystem: CoordSystem;
}

export interface MapSettings {
	tileSets: TileSet[];
	enableGeolocation: boolean;
}

export const DEFAULT_SETTINGS: MapSettings = {
	tileSets: [],
	enableGeolocation: true,
};

interface TilePreset {
	nameKey: keyof Translations;
	lightTiles: string;
	darkTiles: string;
	coordSystem: CoordSystem;
}

const TILE_PRESETS: TilePreset[] = [
	{
		nameKey: 'preset.amapVector',
		lightTiles: 'https://webrd0{1-4}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=8',
		darkTiles: '',
		coordSystem: 'gcj02',
	},
	{
		nameKey: 'preset.amapSatellite',
		lightTiles: 'https://webst0{1-4}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
		darkTiles: '',
		coordSystem: 'gcj02',
	},
	{
		nameKey: 'preset.amapSatelliteRoads',
		lightTiles: 'https://wprd0{1-4}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=8',
		darkTiles: '',
		coordSystem: 'gcj02',
	},
];

class TileSetModal extends Modal {
	tileSet: TileSet;
	onSave: (tileSet: TileSet) => void;
	isNew: boolean;

	constructor(app: App, tileSet: TileSet | null, onSave: (tileSet: TileSet) => void) {
		super(app);
		this.isNew = !tileSet;
		this.tileSet = tileSet || {
			id: Date.now().toString(),
			name: '',
			lightTiles: '',
			darkTiles: '',
			coordSystem: 'wgs84'
		};
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		
		this.setTitle(this.isNew ? t('modal.addBackground') : t('modal.editBackground'));

		new Setting(contentEl)
			.setName(t('modal.name'))
			.setDesc(t('modal.nameDesc'))
			.addText(text => text
				.setPlaceholder(t('modal.namePlaceholder'))
				.setValue(this.tileSet.name)
				.onChange(value => {
					this.tileSet.name = value;
				})
			);

		const lightModeSetting = new Setting(contentEl)
			.setName(t('modal.lightMode'))
			.addText(text => text
				.setPlaceholder('https://tiles.openfreemap.org/styles/bright')
				.setValue(this.tileSet.lightTiles)
				.onChange(value => {
					this.tileSet.lightTiles = value;
				})
			);
		
		lightModeSetting.descEl.innerHTML = t('modal.lightModeDesc');

		new Setting(contentEl)
			.setName(t('modal.darkMode'))
			.setDesc(t('modal.darkModeDesc'))
			.addText(text => text
				.setPlaceholder('https://tiles.openfreemap.org/styles/dark')
				.setValue(this.tileSet.darkTiles)
				.onChange(value => {
					this.tileSet.darkTiles = value;
				})
			);

		new Setting(contentEl)
			.setName(t('modal.coordSystem'))
			.setDesc(t('modal.coordSystemDesc'))
			.addDropdown(dropdown => dropdown
				.addOption('wgs84', t('modal.coordWgs84'))
				.addOption('gcj02', t('modal.coordGcj02'))
				.setValue(this.tileSet.coordSystem || 'wgs84')
				.onChange(value => {
					this.tileSet.coordSystem = value as CoordSystem;
				})
			);

		const buttonContainerEl = modalEl.createDiv('modal-button-container');
		
		buttonContainerEl.createEl('button', { cls: 'mod-cta', text: t('modal.save') })
			.addEventListener('click', () => {
				this.onSave(this.tileSet);
				this.close();
			});
		
		buttonContainerEl.createEl('button', { text: t('modal.cancel') })
			.addEventListener('click', () => {
				this.close();
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class MapSettingTab extends PluginSettingTab {
	plugin: ObsidianMapsPlugin;

	constructor(app: App, plugin: ObsidianMapsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t('settings.enableGeolocation'))
			.setDesc(t('settings.enableGeolocationDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableGeolocation)
				.onChange(async value => {
					this.plugin.settings.enableGeolocation = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setHeading()
			.setName(t('settings.backgrounds'));

		containerEl.createEl('p', {
			cls: 'setting-item-description map-settings-section-desc',
			text: t('settings.backgroundsDesc')
		});

		const addButtonsContainer = containerEl.createDiv('map-settings-add-buttons');
		
		const presetSelect = addButtonsContainer.createEl('select', { cls: 'dropdown' });
		presetSelect.createEl('option', { value: '', text: t('settings.addFromPreset') });
		TILE_PRESETS.forEach((preset, i) => {
			presetSelect.createEl('option', { value: i.toString(), text: t(preset.nameKey) });
		});
		presetSelect.addEventListener('change', async () => {
			const value = presetSelect.value;
			if (value === '') return;
			const preset = TILE_PRESETS[parseInt(value, 10)];
			if (preset) {
				this.plugin.settings.tileSets.push({
					id: Date.now().toString(),
					name: t(preset.nameKey),
					lightTiles: preset.lightTiles,
					darkTiles: preset.darkTiles,
					coordSystem: preset.coordSystem,
				});
				await this.plugin.saveSettings();
				this.display();
			}
		});

		const customBtn = addButtonsContainer.createEl('button', { 
			text: t('settings.addCustom')
		});
		customBtn.addEventListener('click', () => {
			new TileSetModal(this.app, null, async (tileSet) => {
				this.plugin.settings.tileSets.push(tileSet);
				await this.plugin.saveSettings();
				this.display();
			}).open();
		});

		const listContainer = containerEl.createDiv('map-tileset-list');
		
		if (this.plugin.settings.tileSets.length === 0) {
			listContainer.createDiv({
				cls: 'map-tileset-empty',
				text: t('settings.noBackgrounds')
			});
		} else {
			this.plugin.settings.tileSets.forEach((tileSet, index) => {
				this.displayTileSetItem(listContainer, tileSet, index);
			});
		}
	}

	private displayTileSetItem(containerEl: HTMLElement, tileSet: TileSet, index: number): void {
		const itemEl = containerEl.createDiv('map-tileset-item');

		const infoEl = itemEl.createDiv('map-tileset-item-info');
		
		const iconEl = infoEl.createDiv('map-tileset-item-icon');
		setIcon(iconEl, 'map');

		const textEl = infoEl.createDiv('map-tileset-item-text');
		textEl.createDiv({ cls: 'map-tileset-item-name', text: tileSet.name || t('settings.untitled') });
		
		const coordLabel = tileSet.coordSystem === 'gcj02' ? t('modal.coordGcj02') : t('modal.coordWgs84');
		textEl.createDiv({ cls: 'map-tileset-item-meta', text: coordLabel });

		const actionsEl = itemEl.createDiv('map-tileset-item-actions');

		actionsEl.createDiv('clickable-icon', el => {
			setIcon(el, 'pencil');
			setTooltip(el, t('settings.edit'));
			el.addEventListener('click', () => {
				new TileSetModal(this.app, { ...tileSet }, async (updatedTileSet) => {
					this.plugin.settings.tileSets[index] = updatedTileSet;
					await this.plugin.saveSettings();
					this.display();
				}).open();
			});
		});

		actionsEl.createDiv('clickable-icon', el => {
			setIcon(el, 'trash-2');
			setTooltip(el, t('settings.delete'));
			el.addEventListener('click', async () => {
				this.plugin.settings.tileSets.splice(index, 1);
				await this.plugin.saveSettings();
				this.display();
			});
		});
	}
}


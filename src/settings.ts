import { App, Modal, PluginSettingTab, Setting, setIcon, setTooltip } from 'obsidian';
import ObsidianMapsPlugin from './main';

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
}

export const DEFAULT_SETTINGS: MapSettings = {
	tileSets: [],
};

interface TilePreset {
	name: string;
	lightTiles: string;
	darkTiles: string;
	coordSystem: CoordSystem;
}

const TILE_PRESETS: TilePreset[] = [
	{
		name: 'Amap Vector',
		lightTiles: 'https://wprd0{1-4}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=7',
		darkTiles: '',
		coordSystem: 'gcj02',
	},
	{
		name: 'Amap Satellite',
		lightTiles: 'https://webst0{1-4}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
		darkTiles: '',
		coordSystem: 'gcj02',
	},
	{
		name: 'Amap Satellite + Roads',
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
		
		this.setTitle(this.isNew ? 'Add background' : 'Edit background');

		new Setting(contentEl)
			.setName('Name')
			.setDesc('A name for this background.')
			.addText(text => text
				.setPlaceholder('e.g. Terrain, Satellite')
				.setValue(this.tileSet.name)
				.onChange(value => {
					this.tileSet.name = value;
				})
			);

		const lightModeSetting = new Setting(contentEl)
			.setName('Light mode')
			.addText(text => text
				.setPlaceholder('https://tiles.openfreemap.org/styles/bright')
				.setValue(this.tileSet.lightTiles)
				.onChange(value => {
					this.tileSet.lightTiles = value;
				})
			);
		
		lightModeSetting.descEl.innerHTML = 'Tile URL or style URL for light mode. See the <a href="https://help.obsidian.md/bases/views/map">Map view documentation</a> for examples.';

		new Setting(contentEl)
			.setName('Dark mode (optional)')
			.setDesc('Tile URL or style URL for dark mode. If not specified, light mode tiles will be used.')
			.addText(text => text
				.setPlaceholder('https://tiles.openfreemap.org/styles/dark')
				.setValue(this.tileSet.darkTiles)
				.onChange(value => {
					this.tileSet.darkTiles = value;
				})
			);

		new Setting(contentEl)
			.setName('Coordinate system')
			.setDesc('GCJ-02 for Chinese maps (Amap, Tencent). WGS-84 for international maps.')
			.addDropdown(dropdown => dropdown
				.addOption('wgs84', 'WGS-84 (International)')
				.addOption('gcj02', 'GCJ-02 (China)')
				.setValue(this.tileSet.coordSystem || 'wgs84')
				.onChange(value => {
					this.tileSet.coordSystem = value as CoordSystem;
				})
			);

		const buttonContainerEl = modalEl.createDiv('modal-button-container');
		
		buttonContainerEl.createEl('button', { cls: 'mod-cta', text: 'Save' })
			.addEventListener('click', () => {
				this.onSave(this.tileSet);
				this.close();
			});
		
		buttonContainerEl.createEl('button', { text: 'Cancel' })
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
			.setHeading()
			.setName('Backgrounds')
			.addDropdown(dropdown => {
				dropdown.addOption('', 'Add from preset...');
				TILE_PRESETS.forEach((preset, i) => {
					dropdown.addOption(i.toString(), preset.name);
				});
				dropdown.onChange(async value => {
					if (value === '') return;
					const preset = TILE_PRESETS[parseInt(value, 10)];
					if (preset) {
						this.plugin.settings.tileSets.push({
							id: Date.now().toString(),
							name: preset.name,
							lightTiles: preset.lightTiles,
							darkTiles: preset.darkTiles,
							coordSystem: preset.coordSystem,
						});
						await this.plugin.saveSettings();
						this.display();
					}
				});
			})
			.addButton(button => button
				.setButtonText('Add custom')
				.onClick(() => {
					new TileSetModal(this.app, null, async (tileSet) => {
						this.plugin.settings.tileSets.push(tileSet);
						await this.plugin.saveSettings();
						this.display();
					}).open();
				})
			);

		const listContainer = containerEl.createDiv('map-tileset-list');
		
		this.plugin.settings.tileSets.forEach((tileSet, index) => {
			this.displayTileSetItem(listContainer, tileSet, index);
		});

		if (this.plugin.settings.tileSets.length === 0) {
			listContainer.createDiv({
				cls: 'mobile-option-setting-item',
				text: 'Add background sets available to all maps.'
			});
		}
	}

	private displayTileSetItem(containerEl: HTMLElement, tileSet: TileSet, index: number): void {
		const itemEl = containerEl.createDiv('mobile-option-setting-item');

		itemEl.createSpan({ cls: 'mobile-option-setting-item-name', text: tileSet.name || 'Untitled' });

		itemEl.createDiv('clickable-icon', el => {
			setIcon(el, 'pencil');
			setTooltip(el, 'Edit');
			el.addEventListener('click', () => {
				new TileSetModal(this.app, { ...tileSet }, async (updatedTileSet) => {
					this.plugin.settings.tileSets[index] = updatedTileSet;
					await this.plugin.saveSettings();
					this.display();
				}).open();
			});
		});

		itemEl.createDiv('clickable-icon', el => {
			setIcon(el, 'trash-2');
			setTooltip(el, 'Delete');
			el.addEventListener('click', async () => {
				this.plugin.settings.tileSets.splice(index, 1);
				await this.plugin.saveSettings();
				this.display();
			});
		});
	}
}


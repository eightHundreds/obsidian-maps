import {
	BasesView,
	BasesPropertyId,
	debounce,
	HoverParent,
	HoverPopover,
	Menu,
	QueryController,
	Value,
	StringValue,
	NullValue,
	ViewOption,
} from 'obsidian';
import { LngLatLike, Map, setRTLTextPlugin } from 'maplibre-gl';
import type ObsidianMapsPlugin from './main';
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from './map/constants';
import { CustomZoomControl } from './map/controls/zoom-control';
import { BackgroundSwitcherControl } from './map/controls/background-switcher';
import { LocateControl } from './map/controls/locate-control';
import { StyleManager } from './map/style';
import { PopupManager } from './map/popup';
import { MarkerManager } from './map/markers';
import { GeolocationManager } from './map/geolocation';
import { hasOwnProperty, coordinateFromValue } from './map/utils';
import { rtlPluginCode } from './map/rtl-plugin-code';
import { wgs84ToGcj02, gcj02ToWgs84 } from './map/coords';
import type { CoordSystem, TileSet } from './settings';
import { t } from './i18n';

interface MapConfig {
	coordinatesProp: BasesPropertyId | null;
	markerIconProp: BasesPropertyId | null;
	markerColorProp: BasesPropertyId | null;
	mapHeight: number;
	defaultZoom: number;
	center: [number, number];
	maxZoom: number;
	minZoom: number;
	mapTiles: string[];
	mapTilesDark: string[];
	currentTileSetId: string | null;
	mapCoordSystem: CoordSystem;
}

export const MapViewType = 'map';

export class MapView extends BasesView implements HoverParent {
	type = MapViewType;
	scrollEl: HTMLElement;
	containerEl: HTMLElement;
	mapEl: HTMLElement;
	plugin: ObsidianMapsPlugin;
	hoverPopover: HoverPopover | null = null;

	// 内部渲染数据
	private map: Map | null = null;
	private mapConfig: MapConfig | null = null;
	private pendingMapState: { center?: LngLatLike, zoom?: number } | null = null;
	private isFirstLoad = true;
	private lastConfigSnapshot: string | null = null;
	private lastEvaluatedCenter: [number, number] = DEFAULT_MAP_CENTER;

	// 管理器
	private styleManager: StyleManager;
	private popupManager: PopupManager;
	private markerManager: MarkerManager;
	private geolocationManager: GeolocationManager;
	private locateControl: LocateControl | null = null;

	// 用于跟踪 RTL 插件初始化状态的静态标志
	private static rtlPluginInitialized = false;

	constructor(controller: QueryController, scrollEl: HTMLElement, plugin: ObsidianMapsPlugin) {
		super(controller);
		this.scrollEl = scrollEl;
		this.plugin = plugin;
		this.containerEl = scrollEl.createDiv({ cls: 'bases-map-container is-loading', attr: { tabIndex: 0 } });
		this.mapEl = this.containerEl.createDiv('bases-map');

		// 初始化管理器
		this.styleManager = new StyleManager(this.app);
		this.popupManager = new PopupManager(this.containerEl, this.app);
		this.markerManager = new MarkerManager(
			this.app,
			this.mapEl,
			this.popupManager,
			this,
			() => this.data,
			() => this.mapConfig,
			(prop) => this.config.getDisplayName(prop)
		);
		this.geolocationManager = new GeolocationManager();
	}

	onload(): void {
		// 监听主题变化以更新地图瓦片
		this.registerEvent(this.app.workspace.on('css-change', this.onThemeChange, this));
	}

	onunload() {
		this.destroyMap();
	}

	/** 通过防抖减少地图重绘时的闪烁，当窗口大小调整仍在进行时 */
	private onResizeDebounce = debounce(
		() => { if (this.map) this.map.resize() },
		100,
		true);

	onResize(): void {
		this.onResizeDebounce();
	}

	public focus(): void {
		this.containerEl.focus({ preventScroll: true });
	}

	private onThemeChange = (): void => {
		if (this.map) {
			void this.updateMapStyle();
		}
	};

	private async updateMapStyle(): Promise<void> {
		if (!this.map || !this.mapConfig) return;
		const newStyle = await this.styleManager.getMapStyle(this.mapConfig.mapTiles, this.mapConfig.mapTilesDark);
		this.map.setStyle(newStyle);
		this.markerManager.clearLoadedIcons();

		// 样式变化后重新添加标记，因为 setStyle 会移除所有运行时图层
		this.map.once('styledata', () => {
			void this.markerManager.updateMarkers(this.data);
		});
	}

	private async switchToTileSet(tileSetId: string): Promise<void> {
		const tileSet = this.plugin.settings.tileSets.find(ts => ts.id === tileSetId);
		if (!tileSet || !this.mapConfig) return;

		this.mapConfig.currentTileSetId = tileSetId;
		this.mapConfig.mapCoordSystem = tileSet.coordSystem || 'wgs84';

		// 更新当前瓦片
		this.mapConfig.mapTiles = tileSet.lightTiles ? [tileSet.lightTiles] : [];
		this.mapConfig.mapTilesDark = tileSet.darkTiles
			? [tileSet.darkTiles]
			: (tileSet.lightTiles ? [tileSet.lightTiles] : []);

		// 保存到 Base 配置
		this.config.set('background', tileSetId);

		// 更新地图样式
		await this.updateMapStyle();
	}

	private async initializeMap(): Promise<void> {
		if (this.map) return;

		// 初始化 RTL 文本插件（仅一次）
		if (!MapView.rtlPluginInitialized) {
			try {
				// 从打包的 RTL 插件代码创建 blob URL
				// 该插件需要在 worker 上下文中运行
				const blob = new Blob([rtlPluginCode], { type: 'application/javascript' });
				const blobURL = URL.createObjectURL(blob);
				// 设置延迟加载为 false - 因为代码已经打包，插件已初始化
				setRTLTextPlugin(blobURL, false);
				MapView.rtlPluginInitialized = true;
			} catch (error) {
				console.warn('Failed to initialize RTL text plugin:', error);
			}
		}

		// 首先加载配置
		const currentTileSetId = this.mapConfig?.currentTileSetId || null;
		this.mapConfig = this.loadConfig(currentTileSetId);

		// 根据上下文设置初始地图高度
		const isEmbedded = this.isEmbedded();
		if (isEmbedded) {
			this.mapEl.style.height = this.mapConfig.mapHeight + 'px';
		}
		else {
			// 对于直接打开的 base 文件视图，让 CSS 处理高度
			this.mapEl.style.height = '';
		}

		// 获取地图样式（可能涉及获取远程样式 JSON）
		const mapStyle = await this.styleManager.getMapStyle(this.mapConfig.mapTiles, this.mapConfig.mapTilesDark);

		// 确定初始位置：优先使用临时状态，否则使用配置
		let [centerLat, centerLng] = this.mapConfig.center;
		if (this.mapConfig.mapCoordSystem === 'gcj02') {
			[centerLat, centerLng] = wgs84ToGcj02(centerLat, centerLng);
		}
		let initialCenter: [number, number] = [centerLng, centerLat]; // MapLibre 使用 [lng, lat] 格式
		let initialZoom = this.mapConfig.defaultZoom;

		// 判断是否正在恢复之前保存的状态
		const isRestoringState = this.pendingMapState !== null;

		if (this.pendingMapState) {
			if (this.pendingMapState.center) {
				const c = this.pendingMapState.center;
				// 处理 LngLatLike 类型（数组或对象）
				let lat: number, lng: number;
				if (Array.isArray(c)) {
					[lng, lat] = c;
				} else if (typeof c === 'object' && 'lng' in c && 'lat' in c) {
					lng = c.lng;
					lat = c.lat;
				} else {
					lng = initialCenter[0];
					lat = initialCenter[1];
				}
				if (this.mapConfig.mapCoordSystem === 'gcj02') {
					[lat, lng] = wgs84ToGcj02(lat, lng);
				}
				initialCenter = [lng, lat];
			}
			if (this.pendingMapState.zoom !== undefined && this.pendingMapState.zoom !== null) {
				initialZoom = this.pendingMapState.zoom;
			}
		}

		// 使用配置的瓦片或默认样式初始化 MapLibre GL JS 地图
		this.map = new Map({
			container: this.mapEl,
			style: mapStyle,
			center: initialCenter,
			zoom: initialZoom,
			minZoom: this.mapConfig.minZoom,
			maxZoom: this.mapConfig.maxZoom,
		});

		// 在管理器中设置地图引用
		this.popupManager.setMap(this.map);
		this.markerManager.setMap(this.map);

		this.map.addControl(new CustomZoomControl(), 'top-right');

		if (this.plugin.settings.enableGeolocation && this.geolocationManager.isSupported()) {
			this.geolocationManager.setMap(this.map);
			this.geolocationManager.setCoordSystem(this.mapConfig.mapCoordSystem);
			
			this.locateControl = new LocateControl(() => {
				void this.geolocationManager.locateAndFlyTo();
			});
			this.geolocationManager.setOnStatusChange((status) => {
				this.locateControl?.setStatus(status);
			});
			this.map.addControl(this.locateControl, 'top-right');
		}

		if (this.plugin.settings.tileSets.length > 1) {
			const currentId = this.mapConfig.currentTileSetId || this.plugin.settings.tileSets[0]?.id || '';
			if (currentId) {
				this.map.addControl(
					new BackgroundSwitcherControl(
						this.plugin.settings.tileSets,
						currentId,
						(tileSetId) => this.switchToTileSet(tileSetId)
					),
					'top-right'
				);
			}
		}

		this.map.on('error', (e) => {
			console.warn('Map error:', e);
		});

		// 确保地图加载后设置中心点和缩放级别（以防样式加载覆盖它）
		this.map.on('load', () => {
			if (!this.map || !this.mapConfig) return;

			// 如果正在恢复状态，不要重置为默认值
			if (isRestoringState || this.pendingMapState) return;

			const hasConfiguredCenter = this.mapConfig.center[0] !== 0 || this.mapConfig.center[1] !== 0;
			const hasConfiguredZoom = this.config.get('defaultZoom') && Number.isNumber(this.config.get('defaultZoom'));

			// 根据配置设置中心点
			if (hasConfiguredCenter) {
				let [lat, lng] = this.mapConfig.center;
				if (this.mapConfig.mapCoordSystem === 'gcj02') {
					[lat, lng] = wgs84ToGcj02(lat, lng);
				}
				this.map.setCenter([lng, lat]); // MapLibre 使用 [lng, lat] 格式
			}
			else {
				const bounds = this.markerManager.getBounds();
				if (bounds) {
					this.map.setCenter(bounds.getCenter()); // 居中到标记点
				}
			}

			// 根据配置设置缩放级别
			if (hasConfiguredZoom) {
				this.map.setZoom(this.mapConfig.defaultZoom); // 使用配置的缩放级别
			}
			else {
				const bounds = this.markerManager.getBounds();
				if (bounds) {
					this.map.fitBounds(bounds, { padding: 20 }); // 自适应所有标记点
				}
			}
		});

		// 隐藏地图元素上的工具提示
		this.mapEl.querySelector('canvas')?.style
			.setProperty('--no-tooltip', 'true');

		// 向地图添加右键菜单
		this.mapEl.addEventListener('contextmenu', (evt) => {
			evt.preventDefault();
			this.showMapContextMenu(evt);
		});
	}

	private destroyMap(): void {
		this.popupManager.destroy();
		this.geolocationManager.cleanup();
		this.locateControl = null;
		if (this.map) {
			this.map.remove();
			this.map = null;
		}
		this.markerManager.setMap(null);
	}

	public onDataUpdated(): void {
		this.containerEl.removeClass('is-loading');

		const configSnapshot = this.getConfigSnapshot();
		const configChanged = this.lastConfigSnapshot !== configSnapshot;

		const currentTileSetId = this.mapConfig?.currentTileSetId || null;
		this.mapConfig = this.loadConfig(currentTileSetId);

		// 检查计算后的中心点坐标是否发生变化
		const centerChanged = this.mapConfig.center[0] !== this.lastEvaluatedCenter[0] ||
			this.mapConfig.center[1] !== this.lastEvaluatedCenter[1];

		void this.initializeMap().then(async () => {
			// 首次加载或配置变化时应用配置到地图
			if (configChanged) {
				await this.applyConfigToMap(this.lastConfigSnapshot, configSnapshot);
				this.lastConfigSnapshot = configSnapshot;
				this.isFirstLoad = false;
			}
			// 当计算后的中心点坐标变化时更新中心点
			// （例如，当活动文件变化时公式重新计算）
			// 但如果正在恢复临时状态则跳过
			else if (this.map && !this.isFirstLoad && centerChanged && this.pendingMapState === null) {
				this.updateCenter();
			}

			if (this.map && this.data) {
				await this.markerManager.updateMarkers(this.data);

				// 如有可用的待恢复状态则应用（用于恢复临时状态）
				if (this.pendingMapState && this.map) {
					const { center, zoom } = this.pendingMapState;
					if (center) {
						let lat: number, lng: number;
						if ('lng' in center && 'lat' in center) {
							lng = center.lng as number;
							lat = center.lat as number;
						} else {
							[lng, lat] = center as [number, number];
						}
						if (this.mapConfig?.mapCoordSystem === 'gcj02') {
							[lat, lng] = wgs84ToGcj02(lat, lng);
						}
						this.map.setCenter([lng, lat]);
					}
					if (zoom !== null && zoom !== undefined) {
						this.map.setZoom(zoom);
					}
					this.pendingMapState = null;
				}
			}

			// 记录状态以供下次比较
			if (this.mapConfig) {
				this.lastEvaluatedCenter = [this.mapConfig.center[0], this.mapConfig.center[1]];
			}
		});
	}

	private updateZoom(): void {
		if (!this.map || !this.mapConfig) return;

		const hasConfiguredZoom = this.config.get('defaultZoom') != null;
		if (hasConfiguredZoom) {
			this.map.setZoom(this.mapConfig.defaultZoom);
		}
	}

	private updateCenter(): void {
		if (!this.map || !this.mapConfig) return;

		const hasConfiguredCenter = this.mapConfig.center[0] !== 0 || this.mapConfig.center[1] !== 0;
		if (hasConfiguredCenter) {
			const currentCenter = this.map.getCenter();
			if (!currentCenter) return;

			let [lat, lng] = this.mapConfig.center;
			if (this.mapConfig.mapCoordSystem === 'gcj02') {
				[lat, lng] = wgs84ToGcj02(lat, lng);
			}
			const targetCenter: [number, number] = [lng, lat];
			const centerActuallyChanged = Math.abs(currentCenter.lng - targetCenter[0]) > 0.00001 ||
				Math.abs(currentCenter.lat - targetCenter[1]) > 0.00001;
			if (centerActuallyChanged) {
				this.map.setCenter(targetCenter);
			}
		}
	}

	private async applyConfigToMap(oldSnapshot: string | null, newSnapshot: string): Promise<void> {
		if (!this.map || !this.mapConfig) return;

		// 解析快照以检测具体变化
		const oldConfig = oldSnapshot ? JSON.parse(oldSnapshot) : null;
		const newConfig = JSON.parse(newSnapshot);

		// 检测哪些配置发生了变化
		const centerConfigChanged = oldConfig?.center !== newConfig.center;
		const zoomConfigChanged = oldConfig?.defaultZoom !== newConfig.defaultZoom;
		const tilesChanged = JSON.stringify(oldConfig?.mapTiles) !== JSON.stringify(newConfig.mapTiles) ||
			JSON.stringify(oldConfig?.mapTilesDark) !== JSON.stringify(newConfig.mapTilesDark);
		const heightChanged = oldConfig?.mapHeight !== newConfig.mapHeight;

		// 更新地图约束
		this.map.setMinZoom(this.mapConfig.minZoom);
		this.map.setMaxZoom(this.mapConfig.maxZoom);

		// 将当前缩放级别限制在新的最小/最大范围内
		const currentZoom = this.map.getZoom();
		if (currentZoom < this.mapConfig.minZoom) {
			this.map.setZoom(this.mapConfig.minZoom);
		} else if (currentZoom > this.mapConfig.maxZoom) {
			this.map.setZoom(this.mapConfig.maxZoom);
		}

		// 如果有待恢复的临时状态，则跳过更新缩放/中心点
		// （例如，在历史记录中导航以恢复用户上次的平移/缩放时）
		const hasEphemeralState = this.pendingMapState !== null;

		// 仅在首次加载或缩放配置明确更改时更新缩放
		// 但如果正在恢复临时状态则跳过
		if (!hasEphemeralState && (this.isFirstLoad || zoomConfigChanged)) {
			this.updateZoom();
		}

		// 在首次加载或中心点配置更改时更新中心点
		// 但如果正在恢复临时状态则跳过
		if (!hasEphemeralState && (this.isFirstLoad || centerConfigChanged)) {
			this.updateCenter();
		}

		// 如果瓦片配置更改则更新地图样式
		if (this.isFirstLoad || tilesChanged) {
			const newStyle = await this.styleManager.getMapStyle(this.mapConfig.mapTiles, this.mapConfig.mapTilesDark);
			const currentStyle = this.map.getStyle();
			if (JSON.stringify(newStyle) !== JSON.stringify(currentStyle)) {
				this.map.setStyle(newStyle);
				this.markerManager.clearLoadedIcons();
			}
		}

		// 如果高度更改则更新嵌入视图的地图高度
		if (this.isFirstLoad || heightChanged) {
			if (this.isEmbedded()) {
				this.mapEl.style.height = this.mapConfig.mapHeight + 'px';
			}
			else {
				this.mapEl.style.height = '';
			}
			// 高度变化后调整地图大小
			this.map.resize();
		}
	}

	isEmbedded(): boolean {
		// 检查此地图视图是否嵌入在 markdown 文件中而不是直接打开
		// 如果 scrollEl 有一个带有 'bases-embed' 类的父元素，则表示它是嵌入的
		let element = this.scrollEl.parentElement;
		while (element) {
			if (element.hasClass('bases-embed') || element.hasClass('block-language-base')) {
				return true;
			}
			element = element.parentElement;
		}
		return false;
	}

	private loadConfig(currentTileSetId: string | null): MapConfig {
		const coordinatesProp = this.config.getAsPropertyId('coordinates');
		const markerIconProp = this.config.getAsPropertyId('markerIcon');
		const markerColorProp = this.config.getAsPropertyId('markerColor');

		const minZoom = this.getNumericConfig('minZoom', 0, 0, 24);
		const maxZoom = this.getNumericConfig('maxZoom', 18, 0, 24);
		const defaultZoom = this.getNumericConfig('defaultZoom', DEFAULT_MAP_ZOOM, minZoom, maxZoom);

		const center = this.getCenterFromConfig();

		const mapHeight = this.isEmbedded()
			? this.getNumericConfig('mapHeight', DEFAULT_MAP_HEIGHT, 100, 2000)
			: DEFAULT_MAP_HEIGHT;

		const viewSpecificTiles = this.getArrayConfig('mapTiles');
		const viewSpecificTilesDark = this.getArrayConfig('mapTilesDark');
		const backgroundId = this.config.get('background') as string | undefined;
		let mapTiles: string[];
		let mapTilesDark: string[];
		let selectedTileSetId: string | null;
		let mapCoordSystem: CoordSystem = 'wgs84';

		if (viewSpecificTiles.length > 0) {
			mapTiles = viewSpecificTiles;
			mapTilesDark = viewSpecificTilesDark;
			selectedTileSetId = null;
		} else {
			const tileSetId = backgroundId || currentTileSetId;
			const tileSet = tileSetId
				? this.plugin.settings.tileSets.find(ts => ts.id === tileSetId)
				: null;
			const selectedTileSet = tileSet || this.plugin.settings.tileSets[0];

			if (selectedTileSet) {
				selectedTileSetId = selectedTileSet.id;
				mapTiles = selectedTileSet.lightTiles ? [selectedTileSet.lightTiles] : [];
				mapTilesDark = selectedTileSet.darkTiles
					? [selectedTileSet.darkTiles]
					: (selectedTileSet.lightTiles ? [selectedTileSet.lightTiles] : []);
				mapCoordSystem = selectedTileSet.coordSystem || 'wgs84';
			} else {
				mapTiles = [];
				mapTilesDark = [];
				selectedTileSetId = null;
			}
		}

		return {
			coordinatesProp,
			markerIconProp,
			markerColorProp,
			mapHeight,
			defaultZoom,
			center,
			maxZoom,
			minZoom,
			mapTiles,
			mapTilesDark,
			currentTileSetId: selectedTileSetId,
			mapCoordSystem,
		};
	}

	private getNumericConfig(key: string, defaultValue: number, min?: number, max?: number): number {
		const value = this.config.get(key);
		if (value == null || typeof value !== 'number') return defaultValue;

		let result = value;
		if (min !== undefined) result = Math.max(min, result);
		if (max !== undefined) result = Math.min(max, result);
		return result;
	}

	private getArrayConfig(key: string): string[] {
		const value = this.config.get(key);
		if (!value) return [];

		// 处理数组值
		if (Array.isArray(value)) {
			return value.filter(item => typeof item === 'string' && item.trim().length > 0);
		}

		// 处理单个字符串值
		if (typeof value === 'string' && value.trim().length > 0) {
			return [value.trim()];
		}

		return [];
	}

	private getCenterFromConfig(): [number, number] {
		let centerConfig: Value;
		
		try {
			centerConfig = this.config.getEvaluatedFormula(this, 'center');
		} catch (error) {
			// 公式计算失败（例如，当没有活动文件时 this.file 为 null）
			// 回退到原始配置值
			const centerConfigStr = this.config.get('center');
			if (String.isString(centerConfigStr)) {
				centerConfig = new StringValue(centerConfigStr);
			}
			else {
				return DEFAULT_MAP_CENTER;
			}
		}

		// 支持旧版字符串格式
		if (Value.equals(centerConfig, NullValue.value)) {
			const centerConfigStr = this.config.get('center');
			if (String.isString(centerConfigStr)) {
				centerConfig = new StringValue(centerConfigStr);
			}
			else {
				return DEFAULT_MAP_CENTER;
			}
		}
		return coordinateFromValue(centerConfig) || DEFAULT_MAP_CENTER;
	}

	private getConfigSnapshot(): string {
		// 创建影响地图显示的配置值快照
		return JSON.stringify({
			center: this.config.get('center'),
			defaultZoom: this.config.get('defaultZoom'),
			minZoom: this.config.get('minZoom'),
			maxZoom: this.config.get('maxZoom'),
			mapHeight: this.config.get('mapHeight'),
			mapTiles: this.config.get('mapTiles'),
			mapTilesDark: this.config.get('mapTilesDark'),
			background: this.config.get('background'),
		});
	}

	private showMapContextMenu(evt: MouseEvent): void {
		if (!this.map || !this.mapConfig) return;

		const currentZoom = Math.round(this.map.getZoom() * 10) / 10;

		const clickPoint: [number, number] = [evt.offsetX, evt.offsetY];
		const clickedCoords = this.map.unproject(clickPoint);
		let displayLat = Math.round(clickedCoords.lat * 100000) / 100000;
		let displayLng = Math.round(clickedCoords.lng * 100000) / 100000;

		// 如需要，从地图坐标 (GCJ-02) 转换为存储坐标 (WGS-84)
		if (this.mapConfig.mapCoordSystem === 'gcj02') {
			[displayLat, displayLng] = gcj02ToWgs84(displayLat, displayLng);
			displayLat = Math.round(displayLat * 100000) / 100000;
			displayLng = Math.round(displayLng * 100000) / 100000;
		}

		const menu = Menu.forEvent(evt);
		menu.addItem(item => item
			.setTitle(t('menu.newNote'))
			.setSection('action')
			.setIcon('square-pen')
			.onClick(() => {
				void this.createFileForView('', (frontmatter) => {
					if (this.mapConfig?.coordinatesProp) {
						const propertyKey = this.mapConfig.coordinatesProp.startsWith('note.')
							? this.mapConfig.coordinatesProp.slice(5)
							: this.mapConfig.coordinatesProp;
						frontmatter[propertyKey] = [displayLat.toString(), displayLng.toString()];
					}
				});
			})
		);

		menu.addItem(item => item
			.setTitle(t('menu.copyCoordinates'))
			.setSection('action')
			.setIcon('copy')
			.onClick(() => {
				const coordString = `${displayLat}, ${displayLng}`;
				void navigator.clipboard.writeText(coordString);
			})
		);

		menu.addItem(item => item
			.setTitle(t('menu.setDefaultCenter'))
			.setSection('action')
			.setIcon('map-pin')
			.onClick(() => {
				const coordListStr = `[${displayLat}, ${displayLng}]`;

				if (this.mapConfig) {
					this.mapConfig.center = [displayLat, displayLng];
				}

				this.config.set('center', coordListStr);

				// 转换回地图坐标以用于 setCenter
				let mapLat = displayLat, mapLng = displayLng;
				if (this.mapConfig?.mapCoordSystem === 'gcj02') {
					[mapLat, mapLng] = wgs84ToGcj02(displayLat, displayLng);
				}
				this.map?.setCenter([mapLng, mapLat]);
			})
		);

		menu.addItem(item => item
			.setTitle(`${t('menu.setDefaultZoom')} (${currentZoom})`)
			.setSection('action')
			.setIcon('crosshair')
			.onClick(() => {
				this.config.set('defaultZoom', currentZoom);
			})
		);
	}

	public setEphemeralState(state: unknown): void {
		if (!state) {
			this.pendingMapState = null;
			return;
		}

		this.pendingMapState = {};
		if (hasOwnProperty(state, 'center') && hasOwnProperty(state.center, 'lng') && hasOwnProperty(state.center, 'lat')) {
			const lng = state.center.lng;
			const lat = state.center.lat;

			if (typeof lng === 'number' && typeof lat === 'number') {
				this.pendingMapState.center = { lng, lat };
			}
		}
		if (hasOwnProperty(state, 'zoom') && typeof state.zoom === 'number') {
			this.pendingMapState.zoom = state.zoom;
		}
	}

	public getEphemeralState(): unknown {
		if (!this.map || !this.mapConfig) return {};

		const center = this.map.getCenter();
		let lat = center.lat, lng = center.lng;
		if (this.mapConfig.mapCoordSystem === 'gcj02') {
			[lat, lng] = gcj02ToWgs84(lat, lng);
		}
		return {
			center: { lng, lat },
			zoom: this.map.getZoom(),
		};
	}
}

export function getViewOptions(): ViewOption[] {
	return [
		{
			displayName: t('viewOption.embeddedHeight'),
			type: 'slider',
			key: 'mapHeight',
			min: 200,
			max: 800,
			step: 20,
			default: DEFAULT_MAP_HEIGHT,
		},
		{
			displayName: t('viewOption.display'),
			type: 'group',
			items: [
				{
					displayName: t('viewOption.centerCoordinates'),
					type: 'formula',
					key: 'center',
					placeholder: t('viewOption.centerPlaceholder'),
				},
				{
					displayName: t('viewOption.defaultZoom'),
					type: 'slider',
					key: 'defaultZoom',
					min: 1,
					max: 18,
					step: 1,
					default: DEFAULT_MAP_ZOOM,
				},
				{
					displayName: t('viewOption.minZoom'),
					type: 'slider',
					key: 'minZoom',
					min: 0,
					max: 24,
					step: 1,
					default: 0,
				},
				{
					displayName: t('viewOption.maxZoom'),
					type: 'slider',
					key: 'maxZoom',
					min: 0,
					max: 24,
					step: 1,
					default: 18,
				},
			]
		},
		{
			displayName: t('viewOption.markers'),
			type: 'group',
			items: [
				{
					displayName: t('viewOption.markerCoordinates'),
					type: 'property',
					key: 'coordinates',
					filter: (prop: string) => !prop.startsWith('file.'),
					placeholder: t('viewOption.property'),
					default: 'note.location',
				},
				{
					displayName: t('viewOption.markerIcon'),
					type: 'property',
					key: 'markerIcon',
					filter: (prop: string) => !prop.startsWith('file.'),
					placeholder: t('viewOption.property'),
				},
				{
					displayName: t('viewOption.markerColor'),
					type: 'property',
					key: 'markerColor',
					filter: (prop: string) => !prop.startsWith('file.'),
					placeholder: t('viewOption.property'),
				},
			]
		},
		{
			displayName: t('viewOption.customBackground'),
			type: 'group',
			items: [
				{
					displayName: t('viewOption.mapTiles'),
					type: 'multitext',
					key: 'mapTiles',
				},
				{
					displayName: t('viewOption.mapTilesDark'),
					type: 'multitext',
					key: 'mapTilesDark',
				},
			]
		},
	];
}

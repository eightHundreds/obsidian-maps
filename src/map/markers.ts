import { App, BasesEntry, BasesPropertyId, HoverParent, Menu, setIcon } from 'obsidian';
import { Map, LngLatBounds, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import { MapMarker, MapMarkerProperties } from './types';
import { coordinateFromValue } from './utils';
import { PopupManager } from './popup';
import { wgs84ToGcj02 } from './coords';
import type { CoordSystem } from '../settings';

export class MarkerManager {
	private map: Map | null = null;
	private app: App;
	private mapEl: HTMLElement;
	private markers: MapMarker[] = [];
	private bounds: LngLatBounds | null = null;
	private loadedIcons: Set<string> = new Set();
	private popupManager: PopupManager;
	private hoverParent: HoverParent;
	private hoverAnchorEl: HTMLAnchorElement | null = null;
	private getData: () => any;
	private getMapConfig: () => any;
	private getDisplayName: (prop: BasesPropertyId) => string;

	constructor(
		app: App,
		mapEl: HTMLElement,
		popupManager: PopupManager,
		hoverParent: HoverParent,
		getData: () => any,
		getMapConfig: () => any,
		getDisplayName: (prop: BasesPropertyId) => string
	) {
		this.app = app;
		this.mapEl = mapEl;
		this.popupManager = popupManager;
		this.hoverParent = hoverParent;
		this.getData = getData;
		this.getMapConfig = getMapConfig;
		this.getDisplayName = getDisplayName;
	}

	setMap(map: Map | null): void {
		this.map = map;
	}

	private getOrCreateHoverAnchor(): HTMLAnchorElement | null {
		if (!this.map) return null;
		const container = this.map.getContainer();
		if (!this.hoverAnchorEl) {
			const el = document.createElement('a');
			el.className = 'internal-link';
			el.href = '#';
			el.tabIndex = -1;
			el.style.position = 'absolute';
			el.style.width = '1px';
			el.style.height = '1px';
			el.style.pointerEvents = 'none';
			el.style.opacity = '0';
			container.append(el);
			this.hoverAnchorEl = el;
		}
		return this.hoverAnchorEl;
	}

	getMarkers(): MapMarker[] {
		return this.markers;
	}

	getBounds(): LngLatBounds | null {
		return this.bounds;
	}

	clearLoadedIcons(): void {
		this.loadedIcons.clear();
	}

	async updateMarkers(data: { data: BasesEntry[] }): Promise<void> {
		const mapConfig = this.getMapConfig();
		if (!this.map || !data || !mapConfig || !mapConfig.coordinatesProp) {
			return;
		}

		// 收集有效的标记点数据
		const validMarkers: MapMarker[] = [];
		for (const entry of data.data) {
			if (!entry) continue;

			let coordinates: [number, number] | null = null;
			try {
				const value = entry.getValue(mapConfig.coordinatesProp);
				coordinates = coordinateFromValue(value);
			}
			catch (error) {
				console.error(`Error extracting coordinates for ${entry.file.name}:`, error);
			}

			if (coordinates) {
				validMarkers.push({
					entry,
					coordinates,
				});
			}
		}

		this.markers = validMarkers;

		const coordSystem: CoordSystem = mapConfig?.mapCoordSystem || 'wgs84';

		// 计算所有标记点的边界范围
		const bounds = this.bounds = new LngLatBounds();
		validMarkers.forEach(markerData => {
			let [lat, lng] = markerData.coordinates;
			if (coordSystem === 'gcj02') {
				[lat, lng] = wgs84ToGcj02(lat, lng);
			}
			bounds.extend([lng, lat]);
		});

		// 加载所有自定义图标并创建 GeoJSON 要素
		await this.loadCustomIcons(validMarkers);
		const features = this.createGeoJSONFeatures(validMarkers);

		// 更新或创建标记点数据源
		const source = this.map.getSource('markers') as GeoJSONSource | undefined;
		if (source) {
			source.setData({
				type: 'FeatureCollection',
				features,
			});
		} else {
			// 如果数据源不存在则添加
			this.map.addSource('markers', {
				type: 'geojson',
				data: {
					type: 'FeatureCollection',
					features,
				},
			});

			// 添加标记点图层（图标 + 图钉）
			this.addMarkerLayers();
			this.setupMarkerInteractions();
		}
	}

	private getCustomIcon(entry: BasesEntry): string | null {
		const mapConfig = this.getMapConfig();
		if (!mapConfig || !mapConfig.markerIconProp) return null;

		try {
			const value = entry.getValue(mapConfig.markerIconProp);
			if (!value || !value.isTruthy()) return null;

			// 从值中提取图标名称
			const iconString = value.toString().trim();

			// 处理 null/空/无效情况 - 返回 null 以显示默认标记
			if (!iconString || iconString.length === 0 || iconString === 'null' || iconString === 'undefined') {
				return null;
			}

			return iconString;
		}
		catch (error) {
			// 作为警告而非错误记录 - 这不是关键问题
			console.warn(`Could not extract icon for ${entry.file.name}. The marker icon property should be a simple text value (e.g., "map", "star").`, error);
			return null;
		}
	}

	private getCustomColor(entry: BasesEntry): string | null {
		const mapConfig = this.getMapConfig();
		if (!mapConfig || !mapConfig.markerColorProp) return null;

		try {
			const value = entry.getValue(mapConfig.markerColorProp);
			if (!value || !value.isTruthy()) return null;

			// 从属性中提取颜色值
			const colorString = value.toString().trim();

			// 原样返回颜色，让 CSS 处理验证
			// 支持: hex (#ff0000), rgb/rgba, hsl/hsla, CSS 颜色名称, 和 CSS 自定义属性 (var(--color-name))
			return colorString;
		}
		// eslint-disable-next-line no-unused-vars
		catch (_error) {
			// 作为警告而非错误记录 - 这不是关键问题
			console.warn(`Could not extract color for ${entry.file.name}. The marker color property should be a simple text value (e.g., "#ff0000", "red", "var(--color-accent)").`);
			return null;
		}
	}

	private async loadCustomIcons(markers: MapMarker[]): Promise<void> {
		if (!this.map) return;

		// 收集所有需要加载的唯一图标+颜色组合
		const compositeImagesToLoad: Array<{ icon: string | null; color: string }> = [];
		const uniqueKeys = new Set<string>();

		for (const markerData of markers) {
			const icon = this.getCustomIcon(markerData.entry);
			const color = this.getCustomColor(markerData.entry) || 'var(--bases-map-marker-background)';
			const compositeKey = this.getCompositeImageKey(icon, color);

			if (!this.loadedIcons.has(compositeKey) && !uniqueKeys.has(compositeKey)) {
				compositeImagesToLoad.push({ icon, color });
				uniqueKeys.add(compositeKey);
			}
		}

		// 为每个唯一的图标+颜色组合创建合成图像
		for (const { icon, color } of compositeImagesToLoad) {
			try {
				const compositeKey = this.getCompositeImageKey(icon, color);
				const img = await this.createCompositeMarkerImage(icon, color);

				if (this.map) {
					// 在主题变化时强制更新图像
					if (this.map.hasImage(compositeKey)) {
						this.map.removeImage(compositeKey);
					}
					this.map.addImage(compositeKey, img);
					this.loadedIcons.add(compositeKey);
				}
			} catch (error) {
				console.warn(`Failed to create composite marker for icon ${icon}:`, error);
			}
		}
	}

	private getCompositeImageKey(icon: string | null, color: string): string {
		return `marker-${icon || 'dot'}-${color.replaceAll(/[^a-zA-Z0-9]/g, '')}`;
	}

	private resolveColor(color: string): string {
		// 创建临时元素以解析 CSS 变量
		const tempEl = document.createElement('div');
		tempEl.style.color = color;
		tempEl.style.display = 'none';
		document.body.append(tempEl);

		// 获取计算后的颜色值
		const computedColor = getComputedStyle(tempEl).color;

		// 清理临时元素
		tempEl.remove();

		return computedColor;
	}

	private async createCompositeMarkerImage(icon: string | null, color: string): Promise<HTMLImageElement> {
		// 将 CSS 变量解析为实际颜色值
		const resolvedColor = this.resolveColor(color);
		const resolvedIconColor = this.resolveColor('var(--bases-map-marker-icon-color)');

		// 创建高分辨率画布以在视网膜显示屏上清晰渲染
		// 4倍分辨率以获得清晰显示
		const scale = 4;
		// 高分辨率画布
		const size = 48 * scale;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			throw new Error('Failed to get canvas context');
		}

		// 启用高质量渲染
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';

		// 绘制圆形背景（放大）
		const centerX = size / 2;
		const centerY = size / 2;
		const radius = 12 * scale;

		ctx.fillStyle = resolvedColor;
		ctx.beginPath();
		ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
		ctx.fill();

		ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
		ctx.lineWidth = 1 * scale;
		ctx.stroke();

		// 绘制图标或圆点
		if (icon) {
			// 加载并绘制自定义图标
			const iconDiv = createDiv();
			setIcon(iconDiv, icon);
			const svgEl = iconDiv.querySelector('svg');

			if (svgEl) {
				svgEl.setAttribute('stroke', 'currentColor');
				svgEl.setAttribute('fill', 'none');
				svgEl.setAttribute('stroke-width', '2');
				svgEl.style.color = resolvedIconColor;

				const svgString = new XMLSerializer().serializeToString(svgEl);
				const iconImg = new Image();
				iconImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

				await new Promise<void>((resolve, reject) => {
					iconImg.onload = () => {
						// 居中绘制并缩放图标
						const iconSize = radius * 1.2;
						ctx.drawImage(
							iconImg,
							centerX - iconSize / 2,
							centerY - iconSize / 2,
							iconSize,
							iconSize
						);
						resolve();
					};
					iconImg.onerror = reject;
				});
			}
		} else {
			// 绘制圆点
			const dotRadius = 4 * scale;
			ctx.fillStyle = resolvedIconColor;
			ctx.beginPath();
			ctx.arc(centerX, centerY, dotRadius, 0, 2 * Math.PI);
			ctx.fill();
		}

		// 将画布转换为图像
		return new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Failed to create image blob'));
					return;
				}

				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = reject;
				img.src = URL.createObjectURL(blob);
			});
		});
	}

	private createGeoJSONFeatures(markers: MapMarker[]): GeoJSON.Feature[] {
		const mapConfig = this.getMapConfig();
		const coordSystem: CoordSystem = mapConfig?.mapCoordSystem || 'wgs84';

		return markers.map((markerData, index) => {
			let [lat, lng] = markerData.coordinates;
			
			if (coordSystem === 'gcj02') {
				[lat, lng] = wgs84ToGcj02(lat, lng);
			}

			const icon = this.getCustomIcon(markerData.entry);
			const color = this.getCustomColor(markerData.entry) || 'var(--bases-map-marker-background)';
			const compositeKey = this.getCompositeImageKey(icon, color);

			const properties: MapMarkerProperties = {
				entryIndex: index,
				icon: compositeKey,
			};

			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [lng, lat],
				},
				properties,
			};
		});
	}

	private addMarkerLayers(): void {
		if (!this.map) return;

		// 添加用于合成标记图像的单个符号图层
		this.map.addLayer({
			id: 'marker-pins',
			type: 'symbol',
			source: 'markers',
			layout: {
				'icon-image': ['get', 'icon'],
				'icon-size': [
					'interpolate',
					['linear'],
					['zoom'],
					// 非常小
					0, 0.12,
					4, 0.18,
					// 正常大小
					14, 0.22,
					18, 0.24
				],
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
				'icon-padding': 0,
			},
		});
	}

	private setupMarkerInteractions(): void {
		if (!this.map) return;

		// 悬停时改变光标
		this.map.on('mouseenter', 'marker-pins', () => {
			if (this.map) this.map.getCanvas().style.cursor = 'pointer';
		});

		this.map.on('mouseleave', 'marker-pins', () => {
			if (this.map) this.map.getCanvas().style.cursor = '';
		});

		// 处理悬停以显示弹窗
		this.map.on('mouseenter', 'marker-pins', (e: MapLayerMouseEvent) => {
			if (!e.features || e.features.length === 0) return;
			const feature = e.features[0];
			const entryIndex = feature.properties?.entryIndex;
			if (entryIndex !== undefined && this.markers[entryIndex]) {
				const markerData = this.markers[entryIndex];
				const data = this.getData();
				const mapConfig = this.getMapConfig();
				if (data && data.properties && mapConfig) {
					let [lat, lng] = markerData.coordinates;
					if (mapConfig.mapCoordSystem === 'gcj02') {
						[lat, lng] = wgs84ToGcj02(lat, lng);
					}
					this.popupManager.showPopup(
						markerData.entry,
						[lat, lng],
						data.properties,
						mapConfig.coordinatesProp,
						mapConfig.markerIconProp,
						mapConfig.markerColorProp,
						this.getDisplayName
					);
				}
			}
		});

		// 处理鼠标离开以隐藏弹窗
		this.map.on('mouseleave', 'marker-pins', () => {
			this.popupManager.hidePopup();
		});

		// 处理点击以显示可编辑的 hover popover（类似 Cmd + 鼠标悬停链接）
		this.map.on('click', 'marker-pins', (e: MapLayerMouseEvent) => {
			if (!e.features || e.features.length === 0) return;
			const feature = e.features[0];
			const entryIndex = feature.properties?.entryIndex;
			if (entryIndex !== undefined && this.markers[entryIndex]) {
				const markerData = this.markers[entryIndex];
				const anchorEl = this.getOrCreateHoverAnchor();
				if (!anchorEl) return;
				if (typeof e.point?.x === 'number') anchorEl.style.left = `${e.point.x}px`;
				if (typeof e.point?.y === 'number') anchorEl.style.top = `${e.point.y}px`;

				this.app.workspace.trigger(
					'link-hover',
					this.hoverParent,
					anchorEl,
					markerData.entry.file.path,
					markerData.entry.file.path,
					{ mode: 'source' }
				);
			}
		});

		// 处理右键上下文菜单
		this.map.on('contextmenu', 'marker-pins', (e: MapLayerMouseEvent) => {
			e.preventDefault();
			if (!e.features || e.features.length === 0) return;

			const feature = e.features[0];
			const entryIndex = feature.properties?.entryIndex;
			if (entryIndex !== undefined && this.markers[entryIndex]) {
				const markerData = this.markers[entryIndex];
				const [lat, lng] = markerData.coordinates;
				const file = markerData.entry.file;

				const menu = Menu.forEvent(e.originalEvent);
				this.app.workspace.handleLinkContextMenu(menu, file.path, '');

				// 添加复制坐标选项
				menu.addItem(item => item
					.setSection('action')
					.setTitle('Copy coordinates')
					.setIcon('map-pin')
					.onClick(() => {
						const coordString = `${lat}, ${lng}`;
						void navigator.clipboard.writeText(coordString);
					}));

				menu.addItem(item => item
					.setSection('danger')
					.setTitle('Delete file')
					.setIcon('trash-2')
					.setWarning(true)
					.onClick(() => this.app.fileManager.promptForDeletion(file)));
			}
		});

	}
}

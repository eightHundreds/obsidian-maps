export type Locale = 'en' | 'zh';

interface Translations {
	'map': string;
	'settings.enableGeolocation': string;
	'settings.enableGeolocationDesc': string;
	'settings.backgrounds': string;
	'settings.addFromPreset': string;
	'settings.addCustom': string;
	'settings.noBackgrounds': string;
	'settings.edit': string;
	'settings.delete': string;
	'settings.untitled': string;
	'modal.addBackground': string;
	'modal.editBackground': string;
	'modal.name': string;
	'modal.nameDesc': string;
	'modal.namePlaceholder': string;
	'modal.lightMode': string;
	'modal.lightModeDesc': string;
	'modal.darkMode': string;
	'modal.darkModeDesc': string;
	'modal.coordSystem': string;
	'modal.coordSystemDesc': string;
	'modal.coordWgs84': string;
	'modal.coordGcj02': string;
	'modal.save': string;
	'modal.cancel': string;
	'control.locateMe': string;
	'control.zoomIn': string;
	'control.zoomOut': string;
	'control.switchBackground': string;
	'menu.newNote': string;
	'menu.copyCoordinates': string;
	'menu.setDefaultCenter': string;
	'menu.setDefaultZoom': string;
	'viewOption.embeddedHeight': string;
	'viewOption.display': string;
	'viewOption.centerCoordinates': string;
	'viewOption.centerPlaceholder': string;
	'viewOption.defaultZoom': string;
	'viewOption.minZoom': string;
	'viewOption.maxZoom': string;
	'viewOption.markers': string;
	'viewOption.markerCoordinates': string;
	'viewOption.markerIcon': string;
	'viewOption.markerColor': string;
	'viewOption.property': string;
	'viewOption.customBackground': string;
	'viewOption.mapTiles': string;
	'viewOption.mapTilesDark': string;
}

const en: Translations = {
	'map': 'Map',
	'settings.enableGeolocation': 'Enable geolocation',
	'settings.enableGeolocationDesc': 'Show your current location on the map. Requires location permission.',
	'settings.backgrounds': 'Backgrounds',
	'settings.addFromPreset': 'Add from preset...',
	'settings.addCustom': 'Add custom',
	'settings.noBackgrounds': 'Add background sets available to all maps.',
	'settings.edit': 'Edit',
	'settings.delete': 'Delete',
	'settings.untitled': 'Untitled',
	'modal.addBackground': 'Add background',
	'modal.editBackground': 'Edit background',
	'modal.name': 'Name',
	'modal.nameDesc': 'A name for this background.',
	'modal.namePlaceholder': 'e.g. Terrain, Satellite',
	'modal.lightMode': 'Light mode',
	'modal.lightModeDesc': 'Tile URL or style URL for light mode. See the <a href="https://help.obsidian.md/bases/views/map">Map view documentation</a> for examples.',
	'modal.darkMode': 'Dark mode (optional)',
	'modal.darkModeDesc': 'Tile URL or style URL for dark mode. If not specified, light mode tiles will be used.',
	'modal.coordSystem': 'Coordinate system',
	'modal.coordSystemDesc': 'GCJ-02 for Chinese maps (Amap, Tencent). WGS-84 for international maps.',
	'modal.coordWgs84': 'WGS-84 (International)',
	'modal.coordGcj02': 'GCJ-02 (China)',
	'modal.save': 'Save',
	'modal.cancel': 'Cancel',
	'control.locateMe': 'Locate me',
	'control.zoomIn': 'Zoom in',
	'control.zoomOut': 'Zoom out',
	'control.switchBackground': 'Switch background',
	'menu.newNote': 'New note',
	'menu.copyCoordinates': 'Copy coordinates',
	'menu.setDefaultCenter': 'Set default center point',
	'menu.setDefaultZoom': 'Set default zoom',
	'viewOption.embeddedHeight': 'Embedded height',
	'viewOption.display': 'Display',
	'viewOption.centerCoordinates': 'Center coordinates',
	'viewOption.centerPlaceholder': '[latitude, longitude]',
	'viewOption.defaultZoom': 'Default zoom',
	'viewOption.minZoom': 'Minimum zoom',
	'viewOption.maxZoom': 'Maximum zoom',
	'viewOption.markers': 'Markers',
	'viewOption.markerCoordinates': 'Marker coordinates',
	'viewOption.markerIcon': 'Marker icon',
	'viewOption.markerColor': 'Marker color',
	'viewOption.property': 'Property',
	'viewOption.customBackground': 'Custom background',
	'viewOption.mapTiles': 'Map tiles',
	'viewOption.mapTilesDark': 'Map tiles in dark mode',
};

const zh: Translations = {
	'map': '地图',
	'settings.enableGeolocation': '启用地理定位',
	'settings.enableGeolocationDesc': '在地图上显示您的当前位置。需要位置权限。',
	'settings.backgrounds': '背景图层',
	'settings.addFromPreset': '从预设添加...',
	'settings.addCustom': '添加自定义',
	'settings.noBackgrounds': '添加可用于所有地图的背景图层集。',
	'settings.edit': '编辑',
	'settings.delete': '删除',
	'settings.untitled': '未命名',
	'modal.addBackground': '添加背景',
	'modal.editBackground': '编辑背景',
	'modal.name': '名称',
	'modal.nameDesc': '此背景的名称。',
	'modal.namePlaceholder': '例如：地形、卫星',
	'modal.lightMode': '浅色模式',
	'modal.lightModeDesc': '浅色模式的瓦片 URL 或样式 URL。请参阅<a href="https://help.obsidian.md/bases/views/map">地图视图文档</a>获取示例。',
	'modal.darkMode': '深色模式（可选）',
	'modal.darkModeDesc': '深色模式的瓦片 URL 或样式 URL。如果未指定，将使用浅色模式的瓦片。',
	'modal.coordSystem': '坐标系统',
	'modal.coordSystemDesc': 'GCJ-02 用于中国地图（高德、腾讯）。WGS-84 用于国际地图。',
	'modal.coordWgs84': 'WGS-84（国际）',
	'modal.coordGcj02': 'GCJ-02（中国）',
	'modal.save': '保存',
	'modal.cancel': '取消',
	'control.locateMe': '定位我',
	'control.zoomIn': '放大',
	'control.zoomOut': '缩小',
	'control.switchBackground': '切换背景',
	'menu.newNote': '新建笔记',
	'menu.copyCoordinates': '复制坐标',
	'menu.setDefaultCenter': '设为默认中心点',
	'menu.setDefaultZoom': '设为默认缩放级别',
	'viewOption.embeddedHeight': '嵌入高度',
	'viewOption.display': '显示',
	'viewOption.centerCoordinates': '中心坐标',
	'viewOption.centerPlaceholder': '[纬度, 经度]',
	'viewOption.defaultZoom': '默认缩放',
	'viewOption.minZoom': '最小缩放',
	'viewOption.maxZoom': '最大缩放',
	'viewOption.markers': '标记',
	'viewOption.markerCoordinates': '标记坐标',
	'viewOption.markerIcon': '标记图标',
	'viewOption.markerColor': '标记颜色',
	'viewOption.property': '属性',
	'viewOption.customBackground': '自定义背景',
	'viewOption.mapTiles': '地图瓦片',
	'viewOption.mapTilesDark': '深色模式地图瓦片',
};

const translations: Record<Locale, Translations> = { en, zh };

let currentLocale: Locale = 'en';

export function detectLocale(): Locale {
	// @ts-expect-error moment is a global in Obsidian
	const momentLocale = typeof moment !== 'undefined' ? moment.locale() : null;
	
	if (momentLocale) {
		if (momentLocale.startsWith('zh')) {
			return 'zh';
		}
		return 'en';
	}

	const browserLang = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage || 'en';
	if (browserLang.startsWith('zh')) {
		return 'zh';
	}
	return 'en';
}

export function initI18n(): void {
	currentLocale = detectLocale();
}

export function getLocale(): Locale {
	return currentLocale;
}

export function setLocale(locale: Locale): void {
	currentLocale = locale;
}

export function t(key: keyof Translations): string {
	return translations[currentLocale][key] || translations['en'][key] || key;
}

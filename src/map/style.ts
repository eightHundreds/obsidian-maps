import { App } from 'obsidian';
import { StyleSpecification } from 'maplibre-gl';
import { transformMapboxStyle } from '../mapbox-transform';

export class StyleManager {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async getMapStyle(mapTiles: string[], mapTilesDark: string[]): Promise<string | StyleSpecification> {
		const isDark = this.app.isDarkMode();
		const tileUrls = isDark && mapTilesDark.length > 0 ? mapTilesDark : mapTiles;

		let styleUrl: string;
		if (tileUrls.length === 0) {
			styleUrl = isDark ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright';
		} else if (tileUrls.length === 1 && !this.isTileTemplateUrl(tileUrls[0])) {
			styleUrl = tileUrls[0];
		} else {
			styleUrl = '';
		}

		if (styleUrl) {
			try {
				const response = await fetch(styleUrl);
				if (response.ok) {
					const styleJson = await response.json();
					const accessTokenMatch = styleUrl.match(/access_token=([^&]+)/);
					const accessToken = accessTokenMatch ? accessTokenMatch[1] : '';
					const transformedStyle = accessToken
						? transformMapboxStyle(styleJson, accessToken)
						: styleJson;
					return transformedStyle as StyleSpecification;
				}
			} catch (error) {
				console.warn('Failed to fetch style JSON, falling back to URL:', error);
			}
			return styleUrl;
		}

		const expandedUrls = tileUrls.flatMap(url => this.expandSubdomains(url));

		const spec: StyleSpecification = {
			version: 8,
			sources: {
				'custom-tiles': {
					type: 'raster',
					tiles: expandedUrls,
					tileSize: 256
				}
			},
			layers: [{
				id: 'custom-layer',
				type: 'raster',
				source: 'custom-tiles'
			}],
		}
		return spec;
	}

	private expandSubdomains(url: string): string[] {
		const match = url.match(/\{(\d)-(\d)\}/);
		if (!match) return [url];

		const start = parseInt(match[1], 10);
		const end = parseInt(match[2], 10);
		const result: string[] = [];
		for (let i = start; i <= end; i++) {
			result.push(url.replace(match[0], i.toString()));
		}
		return result;
	}

	private isTileTemplateUrl(url: string): boolean {
		return url.includes('{z}') || url.includes('{x}') || url.includes('{y}');
	}
}


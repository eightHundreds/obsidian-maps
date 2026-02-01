import { Map, Marker, LngLatLike } from 'maplibre-gl';
import { Notice } from 'obsidian';
import { wgs84ToGcj02 } from './coords';
import type { CoordSystem } from '../settings';

export interface UserLocation {
	latitude: number;
	longitude: number;
	accuracy: number;
	timestamp: number;
}

export type GeolocationStatus = 'idle' | 'locating' | 'active' | 'error';

export class GeolocationManager {
	private map: Map | null = null;
	private coordSystem: CoordSystem = 'wgs84';
	private userLocation: UserLocation | null = null;
	private watchId: number | null = null;
	private status: GeolocationStatus = 'idle';

	private locationMarker: Marker | null = null;
	private accuracyCircleSourceAdded = false;

	private onStatusChange: ((status: GeolocationStatus) => void) | null = null;
	private onLocationUpdate: ((location: UserLocation) => void) | null = null;

	// Periodic tracking properties
	private periodicTrackingInterval: number | null = null;
	private isPageVisible = true;
	private visibilityChangeHandler: (() => void) | null = null;

	constructor() {
		this.setupVisibilityListener();
	}

	setMap(map: Map | null): void {
		this.map = map;
		if (!map) {
			this.cleanup();
		}
	}

	setCoordSystem(coordSystem: CoordSystem): void {
		this.coordSystem = coordSystem;
		if (this.userLocation) {
			this.updateLocationMarker();
		}
	}

	setOnStatusChange(callback: ((status: GeolocationStatus) => void) | null): void {
		this.onStatusChange = callback;
	}

	setOnLocationUpdate(callback: ((location: UserLocation) => void) | null): void {
		this.onLocationUpdate = callback;
	}

	getStatus(): GeolocationStatus {
		return this.status;
	}

	getUserLocation(): UserLocation | null {
		return this.userLocation;
	}

	isSupported(): boolean {
		return 'geolocation' in navigator;
	}

	locateOnce(): Promise<UserLocation | null> {
		if (!this.isSupported()) {
			new Notice('Geolocation is not supported on this device');
			return Promise.resolve(null);
		}

		this.setStatus('locating');

		return new Promise((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const location = this.processPosition(position);
					this.setStatus('active');
					resolve(location);
				},
				(error) => {
					this.handleError(error);
					resolve(null);
				},
				{
					enableHighAccuracy: true,
					maximumAge: 10000,
					timeout: 15000,
				},
			);
		});
	}

	startWatching(): void {
		if (!this.isSupported()) {
			new Notice('Geolocation is not supported on this device');
			return;
		}

		if (this.watchId !== null) {
			return;
		}

		this.setStatus('locating');

		this.watchId = navigator.geolocation.watchPosition(
			(position) => {
				this.processPosition(position);
				if (this.status !== 'active') {
					this.setStatus('active');
				}
			},
			(error) => {
				this.handleError(error);
			},
			{
				enableHighAccuracy: true,
				maximumAge: 5000,
				timeout: 20000,
			},
		);
	}

	stopWatching(): void {
		if (this.watchId !== null) {
			navigator.geolocation.clearWatch(this.watchId);
			this.watchId = null;
		}
		this.setStatus('idle');
	}

	async startPeriodicTracking(): Promise<boolean> {
		if (!this.isSupported()) {
			new Notice('Geolocation is not supported on this device');
			return false;
		}

		// Already tracking
		if (this.periodicTrackingInterval !== null) {
			return true;
		}

		// Try to locate once first
		const location = await this.locateOnce();

		// Only start periodic tracking if first location was successful
		if (location === null || this.status === 'error') {
			// First location failed, don't start tracking
			this.setStatus('idle');
			return false;
		}

		// First location succeeded, fly to the location
		if (this.map) {
			let lat = location.latitude;
			let lng = location.longitude;
			if (this.coordSystem === 'gcj02') {
				[lat, lng] = wgs84ToGcj02(lat, lng);
			}
			this.map.flyTo({
				center: [lng, lat],
				zoom: Math.max(this.map.getZoom(), 15),
				duration: 1000,
			});
		}

		// Set up interval for periodic tracking (every 30 seconds)
		this.periodicTrackingInterval = window.setInterval(() => {
			// Only locate if page is visible
			if (this.isPageVisible) {
				void this.locateOnce();
			}
		}, 30000);

		return true;
	}

	stopPeriodicTracking(): void {
		if (this.periodicTrackingInterval !== null) {
			window.clearInterval(this.periodicTrackingInterval);
			this.periodicTrackingInterval = null;
		}
		this.setStatus('idle');
	}

	isPeriodicTracking(): boolean {
		return this.periodicTrackingInterval !== null;
	}

	private setupVisibilityListener(): void {
		this.visibilityChangeHandler = () => {
			this.isPageVisible = document.visibilityState === 'visible';
		};
		document.addEventListener('visibilitychange', this.visibilityChangeHandler);
	}

	async locateAndFlyTo(): Promise<void> {
		const location = await this.locateOnce();
		if (location && this.map) {
			let lat = location.latitude;
			let lng = location.longitude;

			if (this.coordSystem === 'gcj02') {
				[lat, lng] = wgs84ToGcj02(lat, lng);
			}

			this.map.flyTo({
				center: [lng, lat],
				zoom: Math.max(this.map.getZoom(), 15),
				duration: 1000,
			});
		}
	}

	private processPosition(position: GeolocationPosition): UserLocation {
		const location: UserLocation = {
			latitude: position.coords.latitude,
			longitude: position.coords.longitude,
			accuracy: position.coords.accuracy,
			timestamp: position.timestamp,
		};

		this.userLocation = location;
		this.updateLocationMarker();
		this.onLocationUpdate?.(location);

		return location;
	}

	private updateLocationMarker(): void {
		if (!this.map || !this.userLocation) return;

		let lat = this.userLocation.latitude;
		let lng = this.userLocation.longitude;

		if (this.coordSystem === 'gcj02') {
			[lat, lng] = wgs84ToGcj02(lat, lng);
		}

		const lngLat: LngLatLike = [lng, lat];

		if (this.locationMarker) {
			this.locationMarker.setLngLat(lngLat);
		} else {
			const el = this.createLocationMarkerElement();
			this.locationMarker = new Marker({ element: el }).setLngLat(lngLat).addTo(this.map);
		}

		this.updateAccuracyCircle(lat, lng, this.userLocation.accuracy);
	}

	private createLocationMarkerElement(): HTMLElement {
		const el = document.createElement('div');
		el.className = 'bases-map-user-location';

		const dot = document.createElement('div');
		dot.className = 'bases-map-user-location-dot';
		el.appendChild(dot);

		const pulse = document.createElement('div');
		pulse.className = 'bases-map-user-location-pulse';
		el.appendChild(pulse);

		return el;
	}

	private updateAccuracyCircle(lat: number, lng: number, accuracy: number): void {
		if (!this.map) return;

		const circleData = this.createCircleGeoJSON(lng, lat, accuracy);

		if (this.accuracyCircleSourceAdded) {
			const source = this.map.getSource('user-location-accuracy');
			if (source && 'setData' in source) {
				(source as maplibregl.GeoJSONSource).setData(circleData);
			}
		} else if (!this.map.getSource('user-location-accuracy')) {
			this.map.addSource('user-location-accuracy', {
				type: 'geojson',
				data: circleData,
			});

			this.map.addLayer({
				id: 'user-location-accuracy-fill',
				type: 'fill',
				source: 'user-location-accuracy',
				paint: {
					'fill-color': '#4285f4',
					'fill-opacity': 0.15,
				},
			});

			this.map.addLayer({
				id: 'user-location-accuracy-stroke',
				type: 'line',
				source: 'user-location-accuracy',
				paint: {
					'line-color': '#4285f4',
					'line-width': 1,
					'line-opacity': 0.3,
				},
			});

			this.accuracyCircleSourceAdded = true;
		}
	}

	private createCircleGeoJSON(
		lng: number,
		lat: number,
		radiusMeters: number,
	): GeoJSON.FeatureCollection {
		const points = 64;
		const coordinates: [number, number][] = [];
		const EARTH_RADIUS_METERS = 6371000;

		for (let i = 0; i <= points; i++) {
			const angle = (i / points) * 2 * Math.PI;
			const latOffset = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
			const lngOffset =
				(radiusMeters / (EARTH_RADIUS_METERS * Math.cos((lat * Math.PI) / 180))) *
				(180 / Math.PI);

			coordinates.push([
				lng + lngOffset * Math.cos(angle),
				lat + latOffset * Math.sin(angle),
			]);
		}

		return {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					geometry: {
						type: 'Polygon',
						coordinates: [coordinates],
					},
					properties: {},
				},
			],
		};
	}

	private handleError(error: GeolocationPositionError): void {
		this.setStatus('error');

		let message = 'Failed to get location';
		switch (error.code) {
			case error.PERMISSION_DENIED:
				message = 'Location permission denied';
				break;
			case error.POSITION_UNAVAILABLE:
				message = 'Location unavailable';
				break;
			case error.TIMEOUT:
				message = 'Location request timed out';
				break;
		}

		new Notice(message);
		console.warn('Geolocation error:', error.message);
	}

	private setStatus(status: GeolocationStatus): void {
		this.status = status;
		this.onStatusChange?.(status);
	}

	removeLocationMarker(): void {
		if (this.locationMarker) {
			this.locationMarker.remove();
			this.locationMarker = null;
		}

		if (this.map && this.accuracyCircleSourceAdded) {
			if (this.map.getLayer('user-location-accuracy-fill')) {
				this.map.removeLayer('user-location-accuracy-fill');
			}
			if (this.map.getLayer('user-location-accuracy-stroke')) {
				this.map.removeLayer('user-location-accuracy-stroke');
			}
			if (this.map.getSource('user-location-accuracy')) {
				this.map.removeSource('user-location-accuracy');
			}
			this.accuracyCircleSourceAdded = false;
		}
	}

	cleanup(): void {
		this.stopWatching();
		this.stopPeriodicTracking();
		this.removeLocationMarker();
		this.userLocation = null;
		this.map = null;

		// Remove visibility change listener
		if (this.visibilityChangeHandler) {
			document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
			this.visibilityChangeHandler = null;
		}
	}
}

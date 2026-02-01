import { setIcon } from 'obsidian';
import { Map } from 'maplibre-gl';
import type { GeolocationStatus } from '../geolocation';
import { t } from '../../i18n';

export class LocateControl {
	private containerEl: HTMLElement;
	private buttonEl: HTMLElement;
	private onStartTracking: () => Promise<boolean>;
	private onStopTracking: () => void;
	private status: GeolocationStatus = 'idle';
	private isTracking: boolean = false;

	constructor(onStartTracking: () => Promise<boolean>, onStopTracking: () => void) {
		this.onStartTracking = onStartTracking;
		this.onStopTracking = onStopTracking;
		this.containerEl = createDiv('maplibregl-ctrl maplibregl-ctrl-group canvas-control-group mod-raised');
		this.buttonEl = this.containerEl.createEl('div', {
			cls: 'maplibregl-ctrl-locate canvas-control-item',
			attr: { 'aria-label': t('control.locateMe') }
		});
		setIcon(this.buttonEl, 'locate');
		this.buttonEl.addEventListener('click', this.handleClick.bind(this));
	}

	onAdd(_map: Map): HTMLElement {
		return this.containerEl;
	}

	onRemove(): void {
		if (this.containerEl?.parentNode) {
			this.containerEl.detach();
		}
	}

	setStatus(status: GeolocationStatus): void {
		this.status = status;
		this.buttonEl.removeClass('is-locating', 'is-active', 'is-error');

		// 当状态变为 error 或 idle 时，清除 tracking 状态以保持一致性
		if (status === 'error' || status === 'idle') {
			this.setTracking(false);
		}

		switch (status) {
			case 'locating':
				this.buttonEl.addClass('is-locating');
				break;
			case 'active':
				this.buttonEl.addClass('is-active');
				break;
			case 'error':
				this.buttonEl.addClass('is-error');
				break;
		}
	}

	setTracking(isTracking: boolean): void {
		this.isTracking = isTracking;
		if (isTracking) {
			this.buttonEl.addClass('is-tracking');
		} else {
			this.buttonEl.removeClass('is-tracking');
		}
	}

	private async handleClick(): Promise<void> {
		if (this.status === 'locating') return;

		if (this.isTracking) {
			// Stop tracking
			this.onStopTracking();
			this.setTracking(false);
		} else {
			// Start tracking - set tracking state optimistically
			this.setTracking(true);

			// Try to start tracking
			const success = await this.onStartTracking();

			// If tracking failed to start, reset the button state
			if (!success) {
				this.setTracking(false);
			}
		}
	}
}

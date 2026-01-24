import { setIcon } from 'obsidian';
import { Map } from 'maplibre-gl';
import type { GeolocationStatus } from '../geolocation';
import { t } from '../../i18n';

export class LocateControl {
	private containerEl: HTMLElement;
	private buttonEl: HTMLElement;
	private onLocate: () => void;
	private status: GeolocationStatus = 'idle';

	constructor(onLocate: () => void) {
		this.onLocate = onLocate;
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

	private handleClick(): void {
		if (this.status === 'locating') return;
		this.onLocate();
	}
}

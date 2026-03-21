import { App, BasesEntry, BasesPropertyId, Keymap, ListValue, Value } from 'obsidian';
import { Popup, Map } from 'maplibre-gl';

export class PopupManager {
	private map: Map | null = null;
	private sharedPopup: Popup | null = null;
	private popupHideTimeout: number | null = null;
	private popupHideTimeoutWin: Window | null = null;
	private containerEl: HTMLElement;
	private app: App;
	private hoverParent: { hoverPopover: any };

	constructor(containerEl: HTMLElement, app: App, hoverParent: { hoverPopover: any }) {
		this.containerEl = containerEl;
		this.app = app;
		this.hoverParent = hoverParent;
	}

	setMap(map: Map | null): void {
		this.map = map;
	}

	showPopup(
		entry: BasesEntry,
		coordinates: [number, number],
		properties: BasesPropertyId[],
		coordinatesProp: BasesPropertyId | null,
		markerIconProp: BasesPropertyId | null,
		markerColorProp: BasesPropertyId | null,
		getDisplayName: (prop: BasesPropertyId) => string,
	): void {
		if (!this.map) return;

		// 仅当有属性值要显示时才显示弹窗
		if (
			!properties ||
			properties.length === 0 ||
			!this.hasAnyPropertyValues(
				entry,
				properties,
				coordinatesProp,
				markerIconProp,
				markerColorProp,
			)
		) {
			return;
		}

		this.clearPopupHideTimeout();

		// 如果弹窗不存在则创建共享弹窗
		if (!this.sharedPopup) {
			const sharedPopup = (this.sharedPopup = new Popup({
				closeButton: false,
				closeOnClick: false,
				offset: 25,
			}));

			// 为弹窗本身添加悬停处理器
			sharedPopup.on('open', () => {
				const popupEl = sharedPopup.getElement();
				if (popupEl) {
					popupEl.addEventListener('mouseenter', () => {
						this.clearPopupHideTimeout();
					});
					popupEl.addEventListener('mouseleave', () => {
						this.hidePopup();
					});
				}
			});
		}

		// 更新弹窗内容和位置
		const [lat, lng] = coordinates;
		const popupContent = this.createPopupContent(
			entry,
			properties,
			coordinatesProp,
			markerIconProp,
			markerColorProp,
			getDisplayName,
		);
		this.sharedPopup.setDOMContent(popupContent).setLngLat([lng, lat]).addTo(this.map);
	}

	hidePopup(): void {
		this.clearPopupHideTimeout();

		const win = (this.popupHideTimeoutWin = this.containerEl.win);
		this.popupHideTimeout = win.setTimeout(() => {
			if (this.sharedPopup) {
				this.sharedPopup.remove();
			}
			this.popupHideTimeout = null;
			this.popupHideTimeoutWin = null;
			// 允许移动到弹窗的小延迟
		}, 150);
	}

	clearPopupHideTimeout(): void {
		if (this.popupHideTimeout) {
			const win = this.popupHideTimeoutWin || this.containerEl.win;
			win.clearTimeout(this.popupHideTimeout);
		}

		this.popupHideTimeoutWin = null;
		this.popupHideTimeout = null;
	}

	destroy(): void {
		this.clearPopupHideTimeout();
		if (this.sharedPopup) {
			this.sharedPopup.remove();
			this.sharedPopup = null;
		}
	}

	private createPopupContent(
		entry: BasesEntry,
		properties: BasesPropertyId[],
		coordinatesProp: BasesPropertyId | null,
		markerIconProp: BasesPropertyId | null,
		markerColorProp: BasesPropertyId | null,
		getDisplayName: (prop: BasesPropertyId) => string,
	): HTMLElement {
		const containerEl = createDiv('bases-map-popup');

		// 获取有值的属性
		// 最多 20 个属性
		const propertiesSlice = properties.slice(0, 20);
		const propertiesWithValues = [];

		for (const prop of propertiesSlice) {
			// 跳过坐标、标记图标和标记颜色属性
			if (prop === coordinatesProp || prop === markerIconProp || prop === markerColorProp)
				continue;

			try {
				const value = entry.getValue(prop);
				if (value && this.hasNonEmptyValue(value)) {
					propertiesWithValues.push({ prop, value });
				}
			} catch {
				// 跳过无法呈现的属性
			}
		}

		// 使用第一个属性作为标题（仍然作为指向文件的链接）
		if (propertiesWithValues.length > 0) {
			const firstProperty = propertiesWithValues[0];
			const titleEl = containerEl.createDiv('bases-map-popup-title');

			// 创建可点击的链接以打开文件
			const titleLinkEl = titleEl.createEl('a', {
				cls: 'internal-link',
			});

			// 点击跳转到文件，支持 Cmd/Ctrl 在新标签页打开
			titleLinkEl.onClickEvent((evt) => {
				if (evt.button !== 0 && evt.button !== 1) return;
				evt.preventDefault();
				const modEvent = Keymap.isModEvent(evt);
				void this.app.workspace.openLinkText(entry.file.path, '', modEvent);
			});

			// 鼠标悬停时触发预览
			titleLinkEl.addEventListener('mouseover', (evt) => {
				this.app.workspace.trigger('hover-link', {
					event: evt,
					source: 'bases',
					hoverParent: this.hoverParent,
					targetEl: titleLinkEl,
					linktext: entry.file.path,
				});
			});

			// 将第一个属性值呈现在链接内
			firstProperty.value.renderTo(titleLinkEl, this.app.renderContext);

			// 显示剩余属性（排除用作标题的第一个属性）
			const remainingProperties = propertiesWithValues.slice(1);
			if (remainingProperties.length > 0) {
				const propContainerEl = containerEl.createDiv('bases-map-popup-properties');
				for (const { prop, value } of remainingProperties) {
					const propEl = propContainerEl.createDiv('bases-map-popup-property');
					const labelEl = propEl.createDiv('bases-map-popup-property-label');
					labelEl.textContent = getDisplayName(prop);
					const valueEl = propEl.createDiv('bases-map-popup-property-value');
					value.renderTo(valueEl, this.app.renderContext);
				}
			}
		}

		return containerEl;
	}

	private hasNonEmptyValue(value: Value): boolean {
		if (!value || !value.isTruthy()) return false;

		// 处理 ListValue - 检查是否有任何非空项
		if (value instanceof ListValue) {
			for (let i = 0; i < value.length(); i++) {
				const item = value.get(i);
				if (item && this.hasNonEmptyValue(item)) {
					return true;
				}
			}
			return false;
		}

		return true;
	}

	private hasAnyPropertyValues(
		entry: BasesEntry,
		properties: BasesPropertyId[],
		coordinatesProp: BasesPropertyId | null,
		markerIconProp: BasesPropertyId | null,
		markerColorProp: BasesPropertyId | null,
	): boolean {
		// 最多 20 个属性
		const propertiesSlice = properties.slice(0, 20);

		for (const prop of propertiesSlice) {
			// 跳过坐标、标记图标和标记颜色属性
			if (prop === coordinatesProp || prop === markerIconProp || prop === markerColorProp)
				continue;

			try {
				const value = entry.getValue(prop);
				if (value && this.hasNonEmptyValue(value)) {
					return true;
				}
			} catch {
				// 跳过无法呈现的属性
			}
		}

		return false;
	}
}

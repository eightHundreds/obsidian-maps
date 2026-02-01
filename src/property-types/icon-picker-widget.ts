import { App, setIcon, getIconIds } from 'obsidian';
import { IconSuggest } from './icon-suggest';
import { t } from '../i18n';

export const ICON_PICKER_TYPE = 'icon-picker';

interface PropertyRenderContext {
	key: string;
	onChange: (value: unknown) => void;
	sourcePath: string;
}

interface IconPickerWidgetComponent {
	type: string;
	focus: () => void;
}

interface IconPickerPropertyWidget {
	type: string;
	icon: string;
	name: () => string;
	default: () => string;
	validate: (value: unknown) => boolean;
	render: (containerEl: HTMLElement, data: unknown, ctx: PropertyRenderContext) => IconPickerWidgetComponent;
}

export function createIconPickerWidget(app: App): IconPickerPropertyWidget {
	return {
		type: ICON_PICKER_TYPE,
		icon: 'lucide-map-pin',
		name: () => t('propertyType.icon'),
		default: () => '',
		validate: (value: unknown) => typeof value === 'string' || value === null || value === undefined,
		render: (containerEl: HTMLElement, data: unknown, ctx: PropertyRenderContext) => {
			// data can be the value directly or an object with { value: ... }
			let value = '';
			if (typeof data === 'string') {
				value = data;
			} else if (data && typeof data === 'object' && 'value' in data) {
				const v = (data as { value?: unknown }).value;
				value = typeof v === 'string' ? v : '';
			}
			
			containerEl.empty();
			containerEl.addClass('icon-picker-widget');

			const wrapper = containerEl.createDiv({ cls: 'icon-picker-wrapper' });

			const previewEl = wrapper.createDiv({ cls: 'icon-picker-preview' });
			if (value && getIconIds().includes(value)) {
				setIcon(previewEl, value);
				previewEl.addClass('has-icon');
			} else {
				previewEl.addClass('no-icon');
				setIcon(previewEl, 'lucide-image-off');
			}

			const inputEl = wrapper.createEl('input', {
				type: 'text',
				cls: 'icon-picker-input',
				value: value,
				placeholder: 'Search icons...',
			});

			new IconSuggest(app, inputEl);

			const clearBtn = wrapper.createDiv({ cls: 'icon-picker-clear clickable-icon' });
			setIcon(clearBtn, 'lucide-x');
			clearBtn.setAttribute('aria-label', 'Clear icon');
			if (!value) clearBtn.addClass('is-hidden');

			inputEl.addEventListener('input', () => {
				const newValue = inputEl.value.trim();
				updatePreview(newValue);
			});

			inputEl.addEventListener('change', () => {
				const newValue = inputEl.value.trim();
				ctx.onChange(newValue || null);
				updatePreview(newValue);
			});

			clearBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				inputEl.value = '';
				ctx.onChange(null);
				updatePreview('');
				inputEl.focus();
			});

			function updatePreview(iconId: string) {
				previewEl.empty();
				if (iconId && getIconIds().includes(iconId)) {
					setIcon(previewEl, iconId);
					previewEl.removeClass('no-icon');
					previewEl.addClass('has-icon');
					clearBtn.removeClass('is-hidden');
				} else {
					setIcon(previewEl, 'lucide-image-off');
					previewEl.removeClass('has-icon');
					previewEl.addClass('no-icon');
					if (iconId) clearBtn.removeClass('is-hidden');
					else clearBtn.addClass('is-hidden');
				}
			}

			return {
				type: ICON_PICKER_TYPE,
				focus: () => inputEl.focus(),
			};
		},
	};
}

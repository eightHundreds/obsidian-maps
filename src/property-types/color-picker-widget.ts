import { App, setIcon } from 'obsidian';
import { ColorSuggest } from './color-suggest';
import { t } from '../i18n';

export const COLOR_PICKER_TYPE = 'color-picker';

interface PropertyRenderContext {
	key: string;
	onChange: (value: unknown) => void;
	sourcePath: string;
}

interface ColorPickerWidgetComponent {
	type: string;
	focus: () => void;
}

interface ColorPickerPropertyWidget {
	type: string;
	icon: string;
	name: () => string;
	default: () => string;
	validate: (value: unknown) => boolean;
	render: (containerEl: HTMLElement, data: unknown, ctx: PropertyRenderContext) => ColorPickerWidgetComponent;
}

function isValidColor(color: string): boolean {
	if (!color) return false;
	if (color.startsWith('var(')) return true;
	if (color.startsWith('#')) return /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);
	if (color.startsWith('rgb')) return true;
	if (color.startsWith('hsl')) return true;
	const namedColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'gray', 'grey'];
	return namedColors.includes(color.toLowerCase());
}

export function createColorPickerWidget(app: App): ColorPickerPropertyWidget {
	return {
		type: COLOR_PICKER_TYPE,
		icon: 'lucide-palette',
		name: () => t('propertyType.color'),
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
			containerEl.addClass('color-picker-widget');

			const wrapper = containerEl.createDiv({ cls: 'color-picker-wrapper' });

			const swatchEl = wrapper.createDiv({ cls: 'color-picker-swatch' });

			const nativeInput = wrapper.createEl('input', {
				type: 'color',
				cls: 'color-picker-native',
				value: value.startsWith('#') ? value : '#3b82f6',
			});

			const textInput = wrapper.createEl('input', {
				type: 'text',
				cls: 'color-picker-input',
				value: value,
				placeholder: '#hex, rgb(), or preset...',
			});

			new ColorSuggest(app, textInput);

			const clearBtn = wrapper.createDiv({ cls: 'color-picker-clear clickable-icon' });
			setIcon(clearBtn, 'lucide-x');
			clearBtn.setAttribute('aria-label', 'Clear color');

			function updateSwatch(color: string) {
				if (color && isValidColor(color)) {
					swatchEl.style.backgroundColor = color;
					swatchEl.removeClass('no-color');
					swatchEl.addClass('has-color');
					clearBtn.removeClass('is-hidden');
				} else {
					swatchEl.style.backgroundColor = '';
					swatchEl.removeClass('has-color');
					swatchEl.addClass('no-color');
					if (color) clearBtn.removeClass('is-hidden');
					else clearBtn.addClass('is-hidden');
				}
			}

			updateSwatch(value);

			swatchEl.addEventListener('click', () => {
				nativeInput.click();
			});

			nativeInput.addEventListener('input', () => {
				const newValue = nativeInput.value;
				textInput.value = newValue;
				updateSwatch(newValue);
				ctx.onChange(newValue);
			});

			textInput.addEventListener('input', () => {
				const newValue = textInput.value.trim();
				updateSwatch(newValue);
			});

			textInput.addEventListener('change', () => {
				const newValue = textInput.value.trim();
				ctx.onChange(newValue || null);
				updateSwatch(newValue);
			});

			clearBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				textInput.value = '';
				ctx.onChange(null);
				updateSwatch('');
				textInput.focus();
			});

			return {
				type: COLOR_PICKER_TYPE,
				focus: () => textInput.focus(),
			};
		},
	};
}

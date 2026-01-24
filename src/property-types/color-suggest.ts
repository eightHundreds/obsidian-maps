import { App, AbstractInputSuggest } from 'obsidian';

interface ColorOption {
	value: string;
	name: string;
}

const PRESET_COLORS: ColorOption[] = [
	{ value: '#ef4444', name: 'Red' },
	{ value: '#f97316', name: 'Orange' },
	{ value: '#eab308', name: 'Yellow' },
	{ value: '#22c55e', name: 'Green' },
	{ value: '#14b8a6', name: 'Teal' },
	{ value: '#3b82f6', name: 'Blue' },
	{ value: '#6366f1', name: 'Indigo' },
	{ value: '#a855f7', name: 'Purple' },
	{ value: '#ec4899', name: 'Pink' },
	{ value: '#78716c', name: 'Stone' },
	{ value: '#64748b', name: 'Slate' },
	{ value: '#171717', name: 'Black' },
	{ value: '#ffffff', name: 'White' },
	{ value: 'var(--color-red)', name: 'Theme Red' },
	{ value: 'var(--color-orange)', name: 'Theme Orange' },
	{ value: 'var(--color-yellow)', name: 'Theme Yellow' },
	{ value: 'var(--color-green)', name: 'Theme Green' },
	{ value: 'var(--color-cyan)', name: 'Theme Cyan' },
	{ value: 'var(--color-blue)', name: 'Theme Blue' },
	{ value: 'var(--color-purple)', name: 'Theme Purple' },
	{ value: 'var(--color-pink)', name: 'Theme Pink' },
	{ value: 'var(--interactive-accent)', name: 'Accent' },
];

export class ColorSuggest extends AbstractInputSuggest<ColorOption> {
	private input: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.input = inputEl;
	}

	protected getSuggestions(query: string): ColorOption[] {
		const lowerQuery = query.toLowerCase().trim();

		if (!lowerQuery) {
			return PRESET_COLORS;
		}

		return PRESET_COLORS.filter(color =>
			color.name.toLowerCase().includes(lowerQuery) ||
			color.value.toLowerCase().includes(lowerQuery)
		);
	}

	public renderSuggestion(option: ColorOption, el: HTMLElement): void {
		el.addClass('color-suggestion-item');

		const swatchEl = el.createSpan({ cls: 'color-suggestion-swatch' });
		swatchEl.style.backgroundColor = option.value;

		el.createSpan({
			text: option.name,
			cls: 'color-suggestion-name',
		});

		el.createSpan({
			text: option.value,
			cls: 'color-suggestion-value',
		});
	}

	public selectSuggestion(option: ColorOption): void {
		this.input.value = option.value;
		this.input.dispatchEvent(new Event('input', { bubbles: true }));
		this.input.dispatchEvent(new Event('change', { bubbles: true }));
		this.close();
	}
}

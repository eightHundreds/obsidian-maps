/**
 * Icon suggestion component for property inputs
 * 
 * Uses Obsidian's getIconIds() API to provide autosuggestion for Lucide icons.
 * Icons are displayed with a visual preview alongside the icon name.
 */

import { App, AbstractInputSuggest, getIconIds, setIcon } from 'obsidian';

/**
 * Icon suggestion provider using AbstractInputSuggest
 */
export class IconSuggest extends AbstractInputSuggest<string> {
	private input: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.input = inputEl;
	}

	protected getSuggestions(query: string): string[] {
		const icons = getIconIds();
		const lowerQuery = query.toLowerCase().trim();

		if (!lowerQuery) {
			// Show popular/common icons when query is empty
			const popularIcons = [
				'lucide-map-pin',
				'lucide-star',
				'lucide-heart',
				'lucide-home',
				'lucide-building',
				'lucide-coffee',
				'lucide-utensils',
				'lucide-shopping-bag',
				'lucide-landmark',
				'lucide-tree-pine',
				'lucide-mountain',
				'lucide-waves',
				'lucide-plane',
				'lucide-train-front',
				'lucide-car',
				'lucide-fuel',
				'lucide-hotel',
				'lucide-tent',
				'lucide-camera',
				'lucide-music',
			];
			return popularIcons.filter(id => icons.includes(id));
		}

		// Filter icons by query
		// Limit results for performance
		return icons
			.filter(icon => icon.toLowerCase().includes(lowerQuery))
			.slice(0, 50);
	}

	public renderSuggestion(iconId: string, el: HTMLElement): void {
		el.addClass('icon-suggestion-item');

		// Create icon preview
		const iconEl = el.createSpan({ cls: 'icon-suggestion-preview' });
		setIcon(iconEl, iconId);

		// Create text label (remove 'lucide-' prefix for cleaner display)
		const displayName = iconId.replace(/^lucide-/, '');
		el.createSpan({
			text: displayName,
			cls: 'icon-suggestion-text',
		});
	}

	public selectSuggestion(iconId: string): void {
		this.input.value = iconId;
		this.input.dispatchEvent(new Event('input', { bubbles: true }));
		this.input.dispatchEvent(new Event('change', { bubbles: true }));
		this.close();
	}
}

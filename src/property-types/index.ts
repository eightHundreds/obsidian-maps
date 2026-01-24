import { App } from 'obsidian';
import { createIconPickerWidget, ICON_PICKER_TYPE } from './icon-picker-widget';
import { createColorPickerWidget, COLOR_PICKER_TYPE } from './color-picker-widget';

type MetadataTypeManager = {
	registeredTypeWidgets: Record<string, unknown>;
	trigger: (event: string) => void;
};

export function registerCustomPropertyTypes(app: App): () => void {
	const metadataTypeManager = (app as unknown as { metadataTypeManager: MetadataTypeManager }).metadataTypeManager;
	
	if (!metadataTypeManager || !metadataTypeManager.registeredTypeWidgets) {
		console.warn('Maps Plugin: MetadataTypeManager not available, custom property types not registered');
		return () => {};
	}

	const iconWidget = createIconPickerWidget(app);
	const colorWidget = createColorPickerWidget(app);
	
	metadataTypeManager.registeredTypeWidgets[ICON_PICKER_TYPE] = iconWidget;
	metadataTypeManager.registeredTypeWidgets[COLOR_PICKER_TYPE] = colorWidget;
	metadataTypeManager.trigger('changed');

	return () => {
		delete metadataTypeManager.registeredTypeWidgets[ICON_PICKER_TYPE];
		delete metadataTypeManager.registeredTypeWidgets[COLOR_PICKER_TYPE];
		metadataTypeManager.trigger('changed');
	};
}

export { ICON_PICKER_TYPE, COLOR_PICKER_TYPE };

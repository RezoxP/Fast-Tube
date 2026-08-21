import { SettingActionRenderer, SettingsCategory } from './ytUI.js';
import { t } from 'i18next';

function PatchSettings(settingsObject) {
    const fasttubeOpenAction = SettingActionRenderer(
        t('settings.ttSettings.title'),
        'fasttube_open_action',
        {
            customAction: {
                action: 'TT_SETTINGS_SHOW',
                parameters: []
            }
        },
        t('settings.ttSettings.summary'),
        'https://www.gstatic.com/ytlr/img/parent_code.png'
    )

    const fasttubeCategory = SettingsCategory(
        'fasttube_category',
        [fasttubeOpenAction]
    );
    // Add it as the first item in the settings object
    settingsObject.items.unshift(fasttubeCategory);

}

export {
    PatchSettings
}
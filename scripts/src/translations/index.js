import i18n from 'i18next';
import resources from './i18nResources.js';

InitI18next('en');

function InitI18next(lng) {
  i18n
    .init({
      lng,
      fallbackLng: 'en',
      resources,
      debug: false,
      interpolation: {
        escapeValue: false,
      }
    });
}
export default i18n;
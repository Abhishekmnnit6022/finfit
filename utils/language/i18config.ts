import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en, hn, tm } from '././translations';

const resources = {
    English: {
        translation: en,
    },
    Hindi: {
        translation: hn,
    },
    Tamil: {
        translation: tm,
    }
};

i18next.use(initReactI18next).init({
    lng: 'English',
    debug: false,
    compatibilityJSON: 'v3',
    fallbackLng: 'English',
    interpolation: {
        escapeValue: false,
    },
    resources,
});

export default i18next;
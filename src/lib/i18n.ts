// src/lib/i18n.ts
//
// Initialisation i18n. Importee une seule fois depuis main.tsx, avant App.
// La locale choisie est persistee : c'est une preference d'affichage, pas une
// donnee sensible — contrairement aux cles API.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import fr from '../locales/fr.json';

export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = 'seeker-locale';

const readStoredLocale = (): Locale | null => {
    try {
        const value = localStorage.getItem(STORAGE_KEY);
        return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : null;
    } catch {
        // localStorage indisponible (mode prive, iframe cloisonnee) : on ignore.
        return null;
    }
};

const envLocale = import.meta.env.VITE_DEFAULT_LOCALE as Locale | undefined;

const initialLocale: Locale =
    readStoredLocale() ??
    (SUPPORTED_LOCALES.includes(envLocale as Locale) ? (envLocale as Locale) : 'en');

void i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        fr: { translation: fr },
    },
    lng: initialLocale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
});

document.documentElement.lang = initialLocale;

i18n.on('languageChanged', (lng) => {
    try {
        localStorage.setItem(STORAGE_KEY, lng);
    } catch {
        // Preference non persistee — sans consequence fonctionnelle.
    }
    document.documentElement.lang = lng;
});

export default i18n;

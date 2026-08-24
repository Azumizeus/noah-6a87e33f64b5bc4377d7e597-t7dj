// src/hooks/useI18n.ts
//
// Acces typé à la traduction et au changement de langue.

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n';

export const useI18n = () => {
    const { t, i18n } = useTranslation();

    const locale = (SUPPORTED_LOCALES.includes(i18n.language as Locale)
        ? i18n.language
        : 'en') as Locale;

    const setLocale = useCallback(
        (next: Locale) => {
            void i18n.changeLanguage(next);
        },
        [i18n],
    );

    return { t, locale, setLocale, locales: SUPPORTED_LOCALES };
};

export default useI18n;

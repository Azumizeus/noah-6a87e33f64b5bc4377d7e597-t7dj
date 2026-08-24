// src/components/LocaleSelector.tsx
//
// Bascule EN / FR. Groupe radio accessible plutot que deux boutons isoles :
// l'etat actif est annonce par les lecteurs d'ecran, pas seulement par la couleur.

import { useI18n } from '@/hooks/useI18n';
import type { Locale } from '@/lib/i18n';

const LABELS: Record<Locale, string> = { en: 'EN', fr: 'FR' };

const LocaleSelector = () => {
    const { locale, setLocale, locales } = useI18n();

    return (
        <div
            role="group"
            aria-label="Langue"
            className="inline-flex items-center gap-0.5 rounded-full border border-[hsl(var(--vault-hairline))] bg-[hsl(var(--vault-elevated))] p-0.5"
        >
            {locales.map((code) => {
                const active = locale === code;
                return (
                    <button
                        key={code}
                        type="button"
                        onClick={() => setLocale(code)}
                        aria-pressed={active}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] transition-colors duration-300 ${
                            active
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {LABELS[code]}
                    </button>
                );
            })}
        </div>
    );
};

export default LocaleSelector;

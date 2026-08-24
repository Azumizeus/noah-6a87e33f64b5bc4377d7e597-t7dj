// src/pages/Pass.tsx
//
// Grille tarifaire. Les boutons d'achat sont DESACTIVES : le programme
// access_gate (T1.2) n'existe pas encore. Un bouton actif qui ne fait rien,
// ou qui simule un achat, serait trompeur sur une page de paiement.

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const TIERS = [
    {
        id: 't1',
        nameKey: 'pass.t1',
        durationKey: 'pass.t1Duration',
        detailKey: 'pass.t1Detail',
        price: '4.99',
        featured: false,
    },
    {
        id: 't2',
        nameKey: 'pass.t2',
        durationKey: 'pass.t2Duration',
        detailKey: 'pass.t2Detail',
        price: '14.99',
        featured: true,
    },
] as const;

const Pass = () => {
    const { t } = useTranslation();

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-10"
        >
            <header>
                <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.06]">
                    {t('pass.title')}
                </h1>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                    {t('pass.subtitle')}
                </p>
            </header>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {TIERS.map((tier) => (
                    <article
                        key={tier.id}
                        className="vault-surface flex flex-col rounded-[20px] border p-7 sm:p-8"
                        style={{
                            borderColor: tier.featured
                                ? 'hsl(var(--primary) / 0.35)'
                                : 'hsl(var(--vault-hairline))',
                            boxShadow: tier.featured ? 'var(--glow-gold)' : undefined,
                        }}
                    >
                        {tier.featured && (
                            <span className="mb-3 inline-flex w-fit rounded-full bg-primary/12 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-primary">
                                {t('pass.popular')}
                            </span>
                        )}

                        <h2 className="text-xl font-semibold">{t(tier.nameKey)}</h2>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                            {t(tier.durationKey)} · {t(tier.detailKey)}
                        </p>

                        <div className="mt-7 flex items-baseline gap-2">
                            <span className="font-mono-vault text-[32px] font-semibold tracking-tight">
                                {tier.price}
                            </span>
                            <span className="text-sm text-muted-foreground">USDC</span>
                        </div>

                        <button
                            type="button"
                            disabled
                            title={t('pass.pending')}
                            className="mt-7 h-12 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
                        >
                            {t('pass.buy')}
                        </button>

                        <p className="mt-3 text-center text-[12px] text-muted-foreground">
                            {t('pass.pending')}
                        </p>
                    </article>
                ))}
            </div>
        </motion.div>
    );
};

export default Pass;

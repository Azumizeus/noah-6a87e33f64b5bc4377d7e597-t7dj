// src/pages/Dashboard.tsx
//
// T1.1 : coquille uniquement. Aucune donnee affichee n'est simulee — les
// cartes sont des emplacements vides, explicitement marques comme tels.

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { useWalletInfo } from '@/hooks/useWalletInfo';

const Dashboard = () => {
    const { t } = useTranslation();
    const { connected } = useWalletInfo();

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-10"
        >
            <header>
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--vault-hairline))] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Solana · Devnet
                </p>
                <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.06]">
                    {t('dashboard.title')}
                </h1>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                    {t('dashboard.subtitle')}
                </p>
            </header>

            {!connected ? (
                <div className="vault-surface rounded-[18px] border border-[hsl(var(--vault-hairline))] p-10 text-center">
                    <p className="text-[15px] text-muted-foreground">
                        {t('dashboard.notConnected')}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[0, 1, 2].map((index) => (
                        <div
                            key={index}
                            className="vault-surface flex min-h-[132px] flex-col justify-between rounded-[18px] border border-[hsl(var(--vault-hairline))] p-6"
                        >
                            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                —
                            </span>
                            <p className="text-[13px] leading-relaxed text-muted-foreground">
                                {t('dashboard.placeholder')}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
};

export default Dashboard;

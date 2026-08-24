// src/pages/Settings.tsx

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { SettingsAIProviders } from '@/components/SettingsAIProviders';
import { useWalletInfo } from '@/hooks/useWalletInfo';

const Settings = () => {
    const { t } = useTranslation();
    const { connected, address, walletName } = useWalletInfo();

    const network = (import.meta.env.VITE_SOLANA_NETWORK as string) || 'devnet';

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-10"
        >
            <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.06]">
                {t('settings.title')}
            </h1>

            <SettingsAIProviders />

            <section className="vault-surface rounded-[20px] border border-[hsl(var(--vault-hairline))] p-6 sm:p-8">
                <h2 className="mb-5 text-lg font-semibold">{t('settings.wallet')}</h2>

                <dl className="space-y-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <dt className="text-muted-foreground">{t('settings.network')}</dt>
                        <dd className="font-mono-vault text-[13px]">{network}</dd>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <dt className="text-muted-foreground">
                            {t('settings.walletConnected')}
                        </dt>
                        <dd className="font-mono-vault break-all text-[13px]">
                            {connected ? address : t('wallet.notConnected')}
                        </dd>
                    </div>
                    {connected && walletName && (
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <dt className="text-muted-foreground">Provider</dt>
                            <dd className="text-[13px]">{walletName}</dd>
                        </div>
                    )}
                </dl>

                <p className="mt-5 text-[12px] text-muted-foreground">
                    {t('settings.walletNote')}
                </p>
            </section>
        </motion.div>
    );
};

export default Settings;

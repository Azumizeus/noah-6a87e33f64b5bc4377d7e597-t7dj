import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Smartphone, Unlock } from 'lucide-react';

const shorten = (address: string) => `${address.slice(0, 6)}…${address.slice(-6)}`;

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] py-3.5 last:border-0">
        <span className="text-[13px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        <span className="font-mono-vault text-sm text-foreground">{value}</span>
    </div>
);

const VaultPanel = () => {
    const { connection } = useConnection();
    const { publicKey, connected, wallet } = useWallet();
    const { setVisible } = useWalletModal();
    const [balance, setBalance] = useState<number | null>(null);

    useEffect(() => {
        let active = true;
        if (!publicKey) {
            setBalance(null);
            return;
        }
        connection
            .getBalance(publicKey)
            .then((lamports) => active && setBalance(lamports / LAMPORTS_PER_SOL))
            .catch(() => active && setBalance(null));
        return () => {
            active = false;
        };
    }, [connection, publicKey]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
            className="grain relative w-full max-w-xl overflow-hidden rounded-[24px] border border-[hsl(var(--vault-hairline))] vault-surface"
        >
            <div className="relative z-10 p-8 sm:p-10">
                <div className="mb-8 flex items-start justify-between gap-6">
                    <div>
                        <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-primary/80">Seed Vault</p>
                        <h2 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                            {connected ? 'Coffre déverrouillé' : 'Coffre verrouillé'}
                        </h2>
                    </div>
                    <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--vault-hairline))] bg-background/60"
                        style={connected ? { boxShadow: 'var(--glow-gold)' } : undefined}
                    >
                        {connected ? (
                            <Unlock className="h-5 w-5 text-primary" />
                        ) : (
                            <Lock className="h-5 w-5 text-muted-foreground" />
                        )}
                    </div>
                </div>

                {connected && publicKey ? (
                    <div>
                        <Row label="Adresse" value={shorten(publicKey.toBase58())} />
                        <Row label="Solde" value={balance === null ? '—' : `${balance.toFixed(4)} SOL`} />
                        <Row label="Wallet" value={wallet?.adapter.name ?? '—'} />
                        <Row
                            label="Réseau"
                            value={<span className="text-[hsl(var(--success))]">Devnet</span>}
                        />
                    </div>
                ) : (
                    <div>
                        <p className="mb-7 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                            Connectez Phantom, Solflare, ou signez depuis le Seed Vault de votre appareil
                            Solana Mobile via le Mobile Wallet Adapter. Vos clés ne quittent jamais
                            votre matériel.
                        </p>
                        <button
                            onClick={() => setVisible(true)}
                            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 sm:w-auto sm:px-8"
                            style={{ boxShadow: 'var(--glow-gold)' }}
                        >
                            Déverrouiller le coffre
                        </button>

                        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[13px] text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-primary/70" />
                                Signature non-custodiale
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <Smartphone className="h-4 w-4 text-primary/70" />
                                MWA / Seed Vault
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default VaultPanel;

import { motion } from 'framer-motion';
import WalletButton from '@/components/WalletButton';
import VaultPanel from '@/components/VaultPanel';
import SignatureTest from '@/components/SignatureTest';

const Index = () => {
    return (
        <div className="relative min-h-screen overflow-hidden bg-background">
            {/* Atmosphere */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(70% 55% at 78% -5%, hsl(38 88% 58% / 0.14), transparent 60%), radial-gradient(60% 50% at 8% 100%, hsl(30 40% 30% / 0.18), transparent 65%)',
                }}
            />

            <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
                <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-md border border-[hsl(var(--vault-hairline))] bg-[hsl(var(--vault-elevated))]" />
                    <span className="font-display text-sm tracking-[0.22em] text-foreground/80">SEED VAULT</span>
                </div>
                <WalletButton />
            </header>

            <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 pb-24 pt-10 sm:px-10 lg:flex-row lg:items-center lg:gap-20 lg:pt-24">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-1"
                >
                    <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--vault-hairline))] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Solana · Devnet
                    </p>
                    <h1 className="max-w-xl text-[clamp(2.6rem,6vw,4.2rem)] font-semibold leading-[1.04] text-foreground">
                        Vos clés,
                        <br />
                        <span className="text-primary">scellées</span> dans le
                        <br />
                        matériel.
                    </h1>
                    <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                        Connexion wallet Solana avec support Phantom, Solflare et Mobile Wallet
                        Adapter — la signature reste dans le Seed Vault de votre appareil.
                    </p>
                </motion.div>

                <div className="flex flex-1 justify-center lg:justify-end">
                    <VaultPanel />
                </div>
            </main>

            <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-28 sm:px-10">
                <SignatureTest />
            </section>
        </div>
    );
};

export default Index;

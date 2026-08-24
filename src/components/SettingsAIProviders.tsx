// src/components/SettingsAIProviders.tsx
//
// Écran de configuration des fournisseurs IA.
//
// Aucune clé n'est persistée côté navigateur : ni localStorage, ni cookie.
// Les valeurs saisies vivent en mémoire le temps de la session et servent
// uniquement au développement local. En production, le relais serveur détient
// les clés et ce panneau devient purement informatif.

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { PROVIDER_CONFIGS, PROVIDER_LIST } from '@/lib/ai-providers/config';
import { aiClient } from '@/lib/ai-providers/client';
import type { AIProvider } from '@/lib/ai-providers/types';

type TestState =
    | { status: 'idle' }
    | { status: 'testing' }
    | { status: 'ok'; latency: number }
    | { status: 'error'; message: string };

const SettingsAIProviders = () => {
    const [tests, setTests] = useState<Partial<Record<AIProvider, TestState>>>({});
    const proxyEnabled = aiClient.isProxyEnabled();

    const handleKeyChange = (provider: AIProvider, value: string) => {
        aiClient.setApiKey(provider, value);
        setTests((prev) => ({ ...prev, [provider]: { status: 'idle' } }));
    };

    const handleTest = async (provider: AIProvider) => {
        setTests((prev) => ({ ...prev, [provider]: { status: 'testing' } }));
        try {
            const res = await aiClient.call({
                provider,
                prompt: 'Réponds uniquement par le mot OK.',
            });
            setTests((prev) => ({
                ...prev,
                [provider]: { status: 'ok', latency: res.latency },
            }));
        } catch (err) {
            setTests((prev) => ({
                ...prev,
                [provider]: {
                    status: 'error',
                    message: err instanceof Error ? err.message : 'Échec inconnu',
                },
            }));
        }
    };

    return (
        <section className="w-full max-w-3xl space-y-6">
            <header>
                <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-primary/80">
                    SAGE
                </p>
                <h2 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                    Fournisseurs IA
                </h2>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                    Les clés saisies ici restent en mémoire, uniquement pour la durée de
                    cet onglet. Elles ne sont écrites nulle part et ne sont jamais
                    envoyées ailleurs qu'au fournisseur choisi.
                </p>
            </header>

            <div
                className="flex items-start gap-3 rounded-[14px] border border-[hsl(var(--vault-hairline))] bg-[hsl(var(--vault-elevated))] p-4"
                role="status"
            >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {proxyEnabled ? (
                        <>
                            Relais serveur actif. Les clés sont détenues côté serveur et ne
                            transitent jamais par le navigateur.
                        </>
                    ) : (
                        <>
                            Relais serveur inactif — mode développement local. Plusieurs API
                            refusent les appels directs depuis un navigateur : un échec de
                            test est attendu tant que le relais n'est pas branché.
                        </>
                    )}
                </p>
            </div>

            <div className="space-y-4">
                {PROVIDER_LIST.map((provider) => {
                    const config = PROVIDER_CONFIGS[provider];
                    const test = tests[provider] ?? { status: 'idle' };
                    const inputId = `ai-key-${provider}`;

                    return (
                        <article
                            key={provider}
                            className="rounded-[18px] border border-[hsl(var(--vault-hairline))] vault-surface p-5 sm:p-6"
                        >
                            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        {config.label}
                                    </h3>
                                    <p className="font-mono-vault mt-1 text-[12px] text-muted-foreground">
                                        {config.model}
                                    </p>
                                </div>
                                {config.unverified && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                                        <AlertTriangle className="h-3 w-3" />
                                        Endpoint non vérifié
                                    </span>
                                )}
                            </div>

                            <label
                                htmlFor={inputId}
                                className="mb-2 block text-[12px] uppercase tracking-[0.14em] text-muted-foreground"
                            >
                                Clé API
                            </label>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <input
                                    id={inputId}
                                    type="password"
                                    autoComplete="off"
                                    spellCheck={false}
                                    disabled={proxyEnabled}
                                    placeholder={
                                        proxyEnabled
                                            ? 'Gérée côté serveur'
                                            : `Clé ${config.label}`
                                    }
                                    onChange={(e) => handleKeyChange(provider, e.target.value)}
                                    className="h-11 flex-1 rounded-[12px] border border-[hsl(var(--input))] bg-background/60 px-4 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]/30 disabled:opacity-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleTest(provider)}
                                    disabled={test.status === 'testing' || config.unverified}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[hsl(var(--border))] bg-secondary px-5 text-sm font-medium text-secondary-foreground transition-all duration-300 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]/40 disabled:opacity-40"
                                >
                                    {test.status === 'testing' && (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    )}
                                    Tester
                                </button>
                            </div>

                            <div className="mt-3 min-h-[20px] text-[13px]" aria-live="polite">
                                {test.status === 'ok' && (
                                    <span className="inline-flex items-center gap-2 text-[hsl(var(--success))]">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Connexion établie — {test.latency} ms
                                    </span>
                                )}
                                {test.status === 'error' && (
                                    <span className="inline-flex items-start gap-2 text-destructive">
                                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                        {test.message}
                                    </span>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>

            <p className="text-[13px] text-muted-foreground">
                Outil d'analyse, pas un conseil en investissement.
            </p>
        </section>
    );
};

export default SettingsAIProviders;

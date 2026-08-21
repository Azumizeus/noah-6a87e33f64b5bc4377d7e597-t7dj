import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    ComputeBudgetProgram,
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js';
import {
    AlertTriangle,
    CheckCircle2,
    KeyRound,
    Loader2,
    RotateCcw,
    XCircle,
    Zap,
} from 'lucide-react';
import RuntimeInfo from '@/components/RuntimeInfo';
import {
    buildCreateNonceAccountTransaction,
    buildDurableNonceTransaction,
    deriveNonceAccount,
    fetchNonceState,
    missingSigners,
} from '@/lib/durableNonce';

/**
 * Memo program — used only to make each test transaction byte-unique.
 * Without it, two 0-lamport self-transfers sharing the same blockhash produce
 * an identical signature and the cluster rejects the second as a duplicate.
 */
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

type Attempt = {
    id: number;
    ok: boolean;
    durable: boolean;
    signature?: string;
    error?: string;
    ms: number;
    at: string;
};

type NonceStatus = 'idle' | 'checking' | 'ready' | 'missing';

const shortSig = (sig: string) => `${sig.slice(0, 8)}…${sig.slice(-8)}`;
const shortKey = (key: string) => `${key.slice(0, 4)}…${key.slice(-4)}`;

const errorMessage = (err: unknown) =>
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Erreur inconnue';

const SignatureTest = () => {
    const { connection } = useConnection();
    const { publicKey, connected, sendTransaction } = useWallet();

    const [busy, setBusy] = useState(false);
    const [settingUp, setSettingUp] = useState(false);
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [useDurable, setUseDurable] = useState(true);
    const [noncePubkey, setNoncePubkey] = useState<PublicKey | null>(null);
    const [nonceStatus, setNonceStatus] = useState<NonceStatus>('idle');
    const [setupError, setSetupError] = useState<string | null>(null);
    const [setupDiag, setSetupDiag] = useState<string | null>(null);
    const counter = useRef(0);

    const successes = attempts.filter((a) => a.ok).length;
    const failures = attempts.length - successes;

    const log = useCallback((entry: Attempt) => setAttempts((prev) => [entry, ...prev]), []);

    /* ---------------------------------------------------------------- */
    /* Nonce account discovery — deterministic, no localStorage needed   */
    /* ---------------------------------------------------------------- */

    useEffect(() => {
        let cancelled = false;

        if (!publicKey || !connected) {
            setNoncePubkey(null);
            setNonceStatus('idle');
            return;
        }

        setNonceStatus('checking');
        void (async () => {
            try {
                // The address is derived from the wallet + a fixed seed, so it is
                // the same on every device and survives a cleared browser storage.
                const derived = await deriveNonceAccount(publicKey);
                if (cancelled) return;
                setNoncePubkey(derived);

                const state = await fetchNonceState(connection, derived, publicKey);
                if (cancelled) return;

                setNonceStatus(state ? 'ready' : 'missing');
            } catch {
                if (!cancelled) setNonceStatus('missing');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [connection, connected, publicKey]);

    /* ---------------------------------------------------------------- */
    /* One-time setup: create + initialize the nonce account             */
    /* ---------------------------------------------------------------- */

    const setupNonce = useCallback(async () => {
        if (!publicKey || !connected) return;

        setSettingUp(true);
        setSetupError(null);
        setSetupDiag(null);
        try {
            const {
                transaction,
                noncePubkey: derived,
                blockhash,
                lastValidBlockHeight,
                minContextSlot,
                requiredSigners,
            } = await buildCreateNonceAccountTransaction({ connection, payer: publicKey });

            // Guard: the seed-derived design must yield exactly one signer.
            // If this ever trips, the transaction would need a co-signature and
            // we would be back in MWA edge-case territory.
            if (requiredSigners !== 1) {
                throw new Error(
                    `Transaction \u00e0 ${requiredSigners} signataires — attendu 1 (wallet seul).`,
                );
            }

            const pending = missingSigners(transaction);

            // Single signer → the standard `sendTransaction` path is enough.
            // This maps to the wallet-standard `signAndSendTransaction` feature,
            // which is the ONLY one that carries an explicit `chain` value
            // (`solana:devnet`, set on the adapter in App.tsx). `signTransaction`
            // carries no chain, which is what made Seed Vault assume mainnet.
            const signature = await sendTransaction(transaction, connection, {
                minContextSlot,
                preflightCommitment: 'confirmed',
            });

            setSetupDiag(
                `sendTransaction \u00b7 signataires requis: ${requiredSigners} (${pending
                    .map(shortKey)
                    .join(', ')}) \u00b7 nonce: ${shortKey(derived.toBase58())}`,
            );

            const result = await connection.confirmTransaction(
                { signature, blockhash, lastValidBlockHeight },
                'confirmed',
            );
            if (result.value.err) {
                throw new Error(`Erreur on-chain : ${JSON.stringify(result.value.err)}`);
            }

            setNoncePubkey(derived);
            setNonceStatus('ready');
        } catch (err) {
            setSetupError(errorMessage(err));
        } finally {
            setSettingUp(false);
        }
    }, [connection, connected, publicKey, sendTransaction]);

    /* ---------------------------------------------------------------- */
    /* Test transaction                                                  */
    /* ---------------------------------------------------------------- */

    const runTest = useCallback(async () => {
        if (!publicKey || !connected) return;

        counter.current += 1;
        const id = counter.current;
        const startedAt = performance.now();
        const durable = useDurable && !!noncePubkey && nonceStatus === 'ready';

        setBusy(true);
        try {
            const instructions: TransactionInstruction[] = [
                ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
                // 0-lamport self transfer — zero financial risk, still a real signature.
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: publicKey,
                    lamports: 0,
                }),
                // Uniqueness nonce (prevents duplicate-signature rejections).
                new TransactionInstruction({
                    keys: [],
                    programId: MEMO_PROGRAM_ID,
                    data: Buffer.from(`sigtest#${id}:${Date.now()}`, 'utf8'),
                }),
            ];

            let signature: string;

            if (durable && noncePubkey) {
                // Read the current nonce value straight from the account.
                const state = await fetchNonceState(connection, noncePubkey, publicKey);
                if (!state) {
                    throw new Error('Compte nonce introuvable ou autorité invalide — recréez-le.');
                }

                const tx = buildDurableNonceTransaction({
                    payer: publicKey,
                    noncePubkey,
                    nonceAuthority: publicKey,
                    nonceValue: state.nonce,
                    instructions,
                });

                signature = await sendTransaction(tx, connection, {
                    minContextSlot: state.minContextSlot,
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                });

                // Nonce-based confirmation: no `lastValidBlockHeight` exists here,
                // web3.js polls the nonce account instead of the block height.
                const result = await connection.confirmTransaction(
                    {
                        signature,
                        minContextSlot: state.minContextSlot,
                        nonceAccountPubkey: noncePubkey,
                        nonceValue: state.nonce,
                    },
                    'confirmed',
                );
                if (result.value.err) {
                    throw new Error(`Erreur on-chain : ${JSON.stringify(result.value.err)}`);
                }
            } else {
                // Baseline path — classic blockhash, expires in ~60–90 s.
                const { context, value: latest } =
                    await connection.getLatestBlockhashAndContext('confirmed');

                const message = new TransactionMessage({
                    payerKey: publicKey,
                    recentBlockhash: latest.blockhash,
                    instructions,
                }).compileToV0Message();

                signature = await sendTransaction(new VersionedTransaction(message), connection, {
                    minContextSlot: context.slot,
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                });

                const result = await connection.confirmTransaction(
                    {
                        signature,
                        blockhash: latest.blockhash,
                        lastValidBlockHeight: latest.lastValidBlockHeight,
                    },
                    'confirmed',
                );
                if (result.value.err) {
                    throw new Error(`Erreur on-chain : ${JSON.stringify(result.value.err)}`);
                }
            }

            log({
                id,
                ok: true,
                durable,
                signature,
                ms: Math.round(performance.now() - startedAt),
                at: new Date().toLocaleTimeString(),
            });
        } catch (err) {
            log({
                id,
                ok: false,
                durable,
                error: errorMessage(err),
                ms: Math.round(performance.now() - startedAt),
                at: new Date().toLocaleTimeString(),
            });
        } finally {
            setBusy(false);
        }
    }, [connection, connected, log, noncePubkey, nonceStatus, publicKey, sendTransaction, useDurable]);

    const reset = useCallback(() => {
        setAttempts([]);
        counter.current = 0;
    }, []);

    const needsSetup = useDurable && nonceStatus !== 'ready';

    return (
        <section className="grain relative w-full overflow-hidden rounded-[24px] border border-[hsl(var(--vault-hairline))] vault-surface">
            <div className="relative z-10 p-8 sm:p-10">
                <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
                    <div>
                        <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-primary/80">
                            Diagnostic
                        </p>
                        <h2 className="text-2xl font-semibold text-foreground sm:text-[28px]">
                            Test de signature
                        </h2>
                        <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
                            Transfert de 0 lamport vers votre propre adresse, sur devnet. Aucun
                            risque : seuls les frais de réseau devnet sont consommés.
                        </p>
                        <div className="mt-3">
                            <RuntimeInfo />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-[hsl(var(--vault-hairline))] bg-background/50 px-4 py-3 text-center">
                            <p className="font-mono-vault text-xl text-[hsl(var(--success))]">
                                {successes}
                            </p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                Succès
                            </p>
                        </div>
                        <div className="rounded-xl border border-[hsl(var(--vault-hairline))] bg-background/50 px-4 py-3 text-center">
                            <p className="font-mono-vault text-xl text-destructive">{failures}</p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                Échecs
                            </p>
                        </div>
                    </div>
                </div>

                {!connected || !publicKey ? (
                    <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--vault-hairline))] bg-background/40 px-5 py-4 text-[14px] text-muted-foreground">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-primary/70" />
                        Connectez un wallet pour lancer le test.
                    </div>
                ) : (
                    <>
                        {/* Durable nonce control -------------------------------- */}
                        <div className="mb-5 rounded-xl border border-[hsl(var(--vault-hairline))] bg-background/40 px-5 py-4">
                            <label className="flex cursor-pointer items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={useDurable}
                                    onChange={(e) => setUseDurable(e.target.checked)}
                                    className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                                />
                                <span>
                                    <span className="block text-[14px] text-foreground">
                                        Nonce durable
                                    </span>
                                    <span className="mt-1 block text-[12px] leading-relaxed text-muted-foreground">
                                        La transaction n'expire jamais : vous pouvez prendre
                                        plusieurs minutes pour lire les avertissements du wallet
                                        avant d'approuver. Décochez pour retomber sur un blockhash
                                        classique (~60–90 s) et comparer.
                                    </span>
                                </span>
                            </label>

                            <div className="mt-3 flex flex-wrap items-center gap-3 pl-7 font-mono-vault text-[11px] text-muted-foreground/80">
                                {nonceStatus === 'checking' && <span>vérification du compte…</span>}
                                {nonceStatus === 'ready' && noncePubkey && (
                                    <span className="inline-flex items-center gap-2">
                                        <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: 'hsl(var(--success))' }}
                                        />
                                        nonce: {shortKey(noncePubkey.toBase58())}
                                    </span>
                                )}
                                {nonceStatus === 'missing' && useDurable && (
                                    <span className="inline-flex items-center gap-2">
                                        <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: 'hsl(var(--primary))' }}
                                        />
                                        aucun compte nonce
                                        {noncePubkey && ` (${shortKey(noncePubkey.toBase58())})`}
                                    </span>
                                )}
                            </div>

                            {needsSetup && nonceStatus !== 'checking' && (
                                <button
                                    onClick={setupNonce}
                                    disabled={settingUp}
                                    className="mt-4 ml-7 inline-flex h-10 items-center gap-2 rounded-full border border-primary/40 px-5 text-[13px] text-foreground transition-colors duration-300 hover:border-primary hover:bg-primary/10 disabled:opacity-50"
                                >
                                    {settingUp ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Création du compte nonce…
                                        </>
                                    ) : (
                                        <>
                                            <KeyRound className="h-3.5 w-3.5" />
                                            Créer le compte nonce (une seule fois)
                                        </>
                                    )}
                                </button>
                            )}

                            {setupDiag && (
                                <p className="mt-3 ml-7 break-words font-mono-vault text-[11px] text-muted-foreground/70">
                                    {setupDiag}
                                </p>
                            )}

                            {setupError && (
                                <p className="mt-3 ml-7 break-words text-[12px] leading-relaxed text-destructive/90">
                                    {setupError}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={runTest}
                                disabled={busy || settingUp || needsSetup}
                                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-all duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                style={{ boxShadow: 'var(--glow-gold)' }}
                            >
                                {busy ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Signature en cours…
                                    </>
                                ) : (
                                    <>
                                        <Zap className="h-4 w-4" />
                                        Lancer un test
                                    </>
                                )}
                            </button>

                            {attempts.length > 0 && (
                                <button
                                    onClick={reset}
                                    disabled={busy}
                                    className="inline-flex h-12 items-center gap-2 rounded-full border border-[hsl(var(--vault-hairline))] px-5 text-sm text-muted-foreground transition-colors duration-300 hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Réinitialiser
                                </button>
                            )}
                        </div>
                    </>
                )}

                {attempts.length > 0 && (
                    <ul className="mt-8 space-y-2">
                        {attempts.map((a) => (
                            <li
                                key={a.id}
                                className="flex items-start gap-3 rounded-xl border border-[hsl(var(--border))] bg-background/40 px-4 py-3"
                            >
                                {a.ok ? (
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
                                ) : (
                                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                )}

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className="font-mono-vault text-[13px] text-foreground">
                                            #{a.id}
                                        </span>
                                        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                            {a.at} · {a.ms} ms ·{' '}
                                            {a.durable ? 'nonce durable' : 'blockhash'}
                                        </span>
                                    </div>

                                    {a.ok && a.signature ? (
                                        <a
                                            href={`https://explorer.solana.com/tx/${a.signature}?cluster=devnet`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-1 block truncate font-mono-vault text-[12px] text-primary underline-offset-4 hover:underline"
                                        >
                                            {shortSig(a.signature)}
                                        </a>
                                    ) : (
                                        <p className="mt-1 break-words text-[12px] leading-relaxed text-destructive/90">
                                            {a.error}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
};

export default SignatureTest;

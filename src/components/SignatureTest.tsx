import { useCallback, useRef, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, XCircle, Zap } from 'lucide-react';

/**
 * Memo program — used only to make each test transaction byte-unique.
 * Without it, two 0-lamport self-transfers sharing the same blockhash produce
 * an identical signature and the cluster rejects the second as a duplicate.
 */
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

type Attempt = {
    id: number;
    ok: boolean;
    signature?: string;
    error?: string;
    ms: number;
    at: string;
};

const shortSig = (sig: string) => `${sig.slice(0, 8)}…${sig.slice(-8)}`;

const SignatureTest = () => {
    const { connection } = useConnection();
    const { publicKey, connected, sendTransaction } = useWallet();

    const [busy, setBusy] = useState(false);
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const counter = useRef(0);

    const successes = attempts.filter((a) => a.ok).length;
    const failures = attempts.length - successes;

    const runTest = useCallback(async () => {
        if (!publicKey || !connected) return;

        counter.current += 1;
        const id = counter.current;
        const startedAt = performance.now();

        setBusy(true);
        try {
            // Legacy Transaction on purpose: Seed Vault / MWA signing is the most
            // reliable path with v0 messages still being inconsistently supported
            // across mobile wallet implementations.
            const tx = new Transaction();

            // 0-lamport self transfer — zero financial risk, still a real signature.
            tx.add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: publicKey,
                    lamports: 0,
                }),
            );

            // Uniqueness nonce.
            tx.add(
                new TransactionInstruction({
                    keys: [],
                    programId: MEMO_PROGRAM_ID,
                    data: Buffer.from(`sigtest#${id}:${Date.now()}`, 'utf8'),
                }),
            );

            const { context, value: latest } =
                await connection.getLatestBlockhashAndContext('confirmed');

            tx.feePayer = publicKey;
            tx.recentBlockhash = latest.blockhash;

            const signature = await sendTransaction(tx, connection, {
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

            setAttempts((prev) => [
                {
                    id,
                    ok: true,
                    signature,
                    ms: Math.round(performance.now() - startedAt),
                    at: new Date().toLocaleTimeString(),
                },
                ...prev,
            ]);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : typeof err === 'string' ? err : 'Erreur inconnue';
            setAttempts((prev) => [
                {
                    id,
                    ok: false,
                    error: message,
                    ms: Math.round(performance.now() - startedAt),
                    at: new Date().toLocaleTimeString(),
                },
                ...prev,
            ]);
        } finally {
            setBusy(false);
        }
    }, [connection, connected, publicKey, sendTransaction]);

    const reset = useCallback(() => {
        setAttempts([]);
        counter.current = 0;
    }, []);

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
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={runTest}
                            disabled={busy}
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
                                            {a.at} · {a.ms} ms
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

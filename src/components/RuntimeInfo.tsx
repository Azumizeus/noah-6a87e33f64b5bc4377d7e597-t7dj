import { useEffect, useMemo, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';

declare const __BUILD_STAMP__: string;

/** Extrait uniquement le domaine — la clé API n'est jamais affichée. */
const hostOf = (endpoint: string) => {
    try {
        return new URL(endpoint).host;
    } catch {
        return endpoint;
    }
};

const PUBLIC_HOSTS = ['api.devnet.solana.com', 'api.mainnet-beta.solana.com', 'api.testnet.solana.com'];

type Health = 'checking' | 'ok' | 'down';

const RuntimeInfo = () => {
    const { connection } = useConnection();
    const [health, setHealth] = useState<Health>('checking');
    const [latency, setLatency] = useState<number | null>(null);

    // On lit l'endpoint réellement utilisé par la Connection au runtime,
    // pas la variable d'environnement — c'est la seule source de vérité.
    const endpoint = connection.rpcEndpoint;
    const host = useMemo(() => hostOf(endpoint), [endpoint]);
    const isPublic = PUBLIC_HOSTS.includes(host);

    const buildStamp = useMemo(() => {
        try {
            return new Date(__BUILD_STAMP__).toLocaleString();
        } catch {
            return 'inconnu';
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        const ping = async () => {
            const started = performance.now();
            try {
                await connection.getVersion();
                if (cancelled) return;
                setLatency(Math.round(performance.now() - started));
                setHealth('ok');
            } catch {
                if (cancelled) return;
                setLatency(null);
                setHealth('down');
            }
        };

        setHealth('checking');
        void ping();

        return () => {
            cancelled = true;
        };
    }, [connection]);

    const dotColor =
        health === 'ok'
            ? isPublic
                ? 'hsl(var(--primary))'
                : 'hsl(var(--success))'
            : health === 'down'
              ? 'hsl(var(--destructive))'
              : 'hsl(var(--muted-foreground))';

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono-vault text-[11px] text-muted-foreground/70">
            <span className="inline-flex items-center gap-2">
                <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor }}
                />
                RPC: {host}
                {isPublic && <span className="text-primary/80">(public)</span>}
            </span>

            <span className="opacity-60">
                {health === 'checking' && 'test…'}
                {health === 'ok' && latency !== null && `${latency} ms`}
                {health === 'down' && 'injoignable'}
            </span>

            <span className="opacity-60">tx: v0</span>
            <span className="opacity-60">build: {buildStamp}</span>
        </div>
    );
};

export default RuntimeInfo;

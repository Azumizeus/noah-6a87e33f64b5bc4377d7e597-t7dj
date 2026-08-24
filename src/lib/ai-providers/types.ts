// src/lib/ai-providers/types.ts
//
// Seeker I — SAGE / infra fournisseurs IA.
//
// Règle CONTEXT-MINI : « IA : BYOK côté serveur ; les clés restent chiffrées
// côté serveur et ne sont jamais renvoyées au navigateur. »
//
// Conséquence : aucune clé n'est persistée dans le navigateur (pas de
// localStorage, pas de sessionStorage, pas de cookie). Les clés saisies en
// développement vivent uniquement en mémoire, le temps de l'onglet.

export type AIProvider =
    | 'anthropic'
    | 'openrouter'
    | 'openai'
    | 'opencode'
    | 'mammothia';

export interface AIProviderConfig {
    name: AIProvider;
    label: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    /** true = endpoint non vérifié, ne pas utiliser sans confirmation. */
    unverified?: boolean;
    /** true = l'API refuse les appels directs depuis un navigateur (CORS). */
    requiresServerProxy?: boolean;
}

export interface AIRequestContext {
    /** Données de token observées, transmises telles quelles au prompt. */
    tokenData?: unknown;
    /** Adresse publique uniquement. Jamais de clé privée ni de seed. */
    walletAddress?: string;
    recentTrades?: unknown[];
}

export interface AIRequest {
    provider: AIProvider;
    prompt: string;
    context?: AIRequestContext;
}

export interface AITokenUsage {
    input: number;
    output: number;
}

export interface AIResponse {
    provider: AIProvider;
    content: string;
    tokens: AITokenUsage;
    /** Durée totale de l'appel, en millisecondes. */
    latency: number;
}

/**
 * Ordre de bascule. Claude en primaire, conformément au contexte projet.
 * Les fournisseurs non vérifiés restent en fin de chaîne et sont ignorés
 * tant que leur endpoint n'est pas confirmé.
 */
export const PROVIDER_FALLBACK_CHAIN: readonly AIProvider[] = [
    'anthropic',
    'openrouter',
    'openai',
    'opencode',
    'mammothia',
] as const;

/**
 * Fournisseurs dont l'URL d'API n'a pas été vérifiée. Ils sont exclus de la
 * bascule automatique. Aucune adresse n'est inventée : à confirmer avant
 * activation.
 */
export const UNVERIFIED_PROVIDERS: readonly AIProvider[] = [
    'opencode',
    'mammothia',
] as const;

/** Erreur typée, pour distinguer un échec fournisseur d'un bug applicatif. */
export class AIProviderError extends Error {
    constructor(
        public readonly provider: AIProvider,
        message: string,
        public readonly status?: number,
    ) {
        super(message);
        this.name = 'AIProviderError';
    }
}

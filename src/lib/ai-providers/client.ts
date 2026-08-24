// src/lib/ai-providers/client.ts
//
// Orchestrateur des fournisseurs IA.
//
// Deux modes :
//   1. RELAIS SERVEUR (cible v1) — setProxyBaseUrl() est défini. Le navigateur
//      n'envoie jamais de clé : elle est lue côté serveur, chiffrée au repos.
//   2. DIRECT (développement local uniquement) — la clé est fournie par
//      l'utilisateur et gardée EN MÉMOIRE, jamais persistée. Plusieurs API
//      refusent ce mode en CORS : c'est attendu, pas un bug.

import {
    AIProviderError,
    PROVIDER_FALLBACK_CHAIN,
    UNVERIFIED_PROVIDERS,
    type AIProvider,
    type AIProviderConfig,
    type AIRequest,
    type AIResponse,
    type AITokenUsage,
} from './types';
import { PROVIDER_CONFIGS } from './config';

interface RawCompletion {
    content: string;
    tokens: AITokenUsage;
}

export class AIProviderClient {
    /** Clés en mémoire uniquement. Jamais écrites sur disque ni en storage. */
    private readonly apiKeys = new Map<AIProvider, string>();

    /** URL du relais serveur (Supabase Edge Function). */
    private proxyBaseUrl: string | null = null;

    // ---------------------------------------------------------------- config

    /**
     * Active le mode relais. Une fois défini, les clés client ne sont plus
     * utilisées : le serveur détient et utilise les siennes.
     */
    setProxyBaseUrl(url: string | null): void {
        this.proxyBaseUrl = url && url.trim() !== '' ? url.replace(/\/+$/, '') : null;
    }

    isProxyEnabled(): boolean {
        return this.proxyBaseUrl !== null;
    }

    /** BYOK développement. La clé reste en mémoire pour la session. */
    setApiKey(provider: AIProvider, apiKey: string): void {
        const trimmed = apiKey.trim();
        if (trimmed === '') {
            this.apiKeys.delete(provider);
            return;
        }
        this.apiKeys.set(provider, trimmed);
    }

    clearApiKey(provider: AIProvider): void {
        this.apiKeys.delete(provider);
    }

    clearAllApiKeys(): void {
        this.apiKeys.clear();
    }

    hasApiKey(provider: AIProvider): boolean {
        return this.apiKeys.has(provider);
    }

    /** Fournisseur utilisable : endpoint vérifié + relais ou clé disponible. */
    isAvailable(provider: AIProvider): boolean {
        if (UNVERIFIED_PROVIDERS.includes(provider)) return false;
        return this.isProxyEnabled() || this.hasApiKey(provider);
    }

    // ------------------------------------------------------------- exécution

    /**
     * Appel avec bascule automatique. Lève si tous les fournisseurs échouent —
     * jamais de réponse simulée en cas d'échec.
     */
    async callWithFallback(request: Omit<AIRequest, 'provider'>): Promise<AIResponse> {
        const failures: string[] = [];

        for (const provider of PROVIDER_FALLBACK_CHAIN) {
            if (!this.isAvailable(provider)) {
                failures.push(`${provider}: indisponible`);
                continue;
            }
            try {
                return await this.call({ ...request, provider });
            } catch (err) {
                failures.push(
                    `${provider}: ${err instanceof Error ? err.message : 'erreur inconnue'}`,
                );
            }
        }

        throw new AIProviderError(
            PROVIDER_FALLBACK_CHAIN[0],
            `Tous les fournisseurs ont échoué — ${failures.join(' | ')}`,
        );
    }

    /** Appel d'un fournisseur précis. Public : utilisé par l'écran réglages. */
    async call(request: AIRequest): Promise<AIResponse> {
        const config = PROVIDER_CONFIGS[request.provider];
        if (!config) {
            throw new AIProviderError(request.provider, 'Fournisseur inconnu.');
        }
        if (config.unverified) {
            throw new AIProviderError(
                request.provider,
                "Endpoint non vérifié : aucune URL d'API confirmée pour ce fournisseur.",
            );
        }

        const startedAt = Date.now();
        const prompt = buildPrompt(request);

        const raw = this.isProxyEnabled()
            ? await this.callViaProxy(request.provider, prompt)
            : await this.callDirect(request.provider, config, prompt);

        return {
            provider: request.provider,
            content: raw.content,
            tokens: raw.tokens,
            latency: Date.now() - startedAt,
        };
    }

    // ----------------------------------------------------------- relais serveur

    private async callViaProxy(
        provider: AIProvider,
        prompt: string,
    ): Promise<RawCompletion> {
        const res = await fetch(`${this.proxyBaseUrl}/ai-proxy`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider, prompt }),
        });

        if (!res.ok) {
            throw new AIProviderError(
                provider,
                `Relais serveur — HTTP ${res.status}`,
                res.status,
            );
        }

        const data = (await res.json()) as Partial<RawCompletion>;
        if (typeof data.content !== 'string') {
            throw new AIProviderError(provider, 'Réponse du relais illisible.');
        }

        return {
            content: data.content,
            tokens: data.tokens ?? { input: 0, output: 0 },
        };
    }

    // ------------------------------------------------------------ appels directs

    private async callDirect(
        provider: AIProvider,
        config: AIProviderConfig,
        prompt: string,
    ): Promise<RawCompletion> {
        const apiKey = this.apiKeys.get(provider);
        if (!apiKey) {
            throw new AIProviderError(
                provider,
                `Aucune clé disponible pour ${provider}.`,
            );
        }

        switch (provider) {
            case 'anthropic':
                return this.callAnthropic(apiKey, config, prompt);
            case 'openai':
                return this.callOpenAI(apiKey, config, prompt);
            case 'openrouter':
                return this.callOpenRouter(apiKey, config, prompt);
            case 'opencode':
                return this.callOpenCode(apiKey, config, prompt);
            case 'mammothia':
                return this.callMammothIA(apiKey, config, prompt);
            default:
                throw new AIProviderError(provider, `Fournisseur inconnu : ${provider}`);
        }
    }

    private async callAnthropic(
        apiKey: string,
        config: AIProviderConfig,
        prompt: string,
    ): Promise<RawCompletion> {
        const res = await fetch(`${config.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model,
                max_tokens: config.maxTokens,
                temperature: config.temperature,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!res.ok) {
            throw new AIProviderError(
                'anthropic',
                `Anthropic — HTTP ${res.status}`,
                res.status,
            );
        }

        const data = await res.json();
        const text = data?.content?.[0]?.text;
        if (typeof text !== 'string') {
            throw new AIProviderError('anthropic', 'Réponse Anthropic illisible.');
        }

        return {
            content: text,
            tokens: {
                input: Number(data?.usage?.input_tokens ?? 0),
                output: Number(data?.usage?.output_tokens ?? 0),
            },
        };
    }

    // Les quatre adaptateurs ci-dessous attendent leurs spécifications.
    // Ils lèvent explicitement : aucun mock silencieux, aucune réponse inventée.
    /* eslint-disable @typescript-eslint/no-unused-vars */

    private async callOpenAI(
        _apiKey: string,
        _config: AIProviderConfig,
        _prompt: string,
    ): Promise<RawCompletion> {
        throw new AIProviderError('openai', 'Adaptateur OpenAI non implémenté.');
    }

    private async callOpenRouter(
        _apiKey: string,
        _config: AIProviderConfig,
        _prompt: string,
    ): Promise<RawCompletion> {
        throw new AIProviderError(
            'openrouter',
            'Adaptateur OpenRouter non implémenté.',
        );
    }

    private async callOpenCode(
        _apiKey: string,
        _config: AIProviderConfig,
        _prompt: string,
    ): Promise<RawCompletion> {
        throw new AIProviderError(
            'opencode',
            'Adaptateur OpenCode non implémenté (endpoint non vérifié).',
        );
    }

    private async callMammothIA(
        _apiKey: string,
        _config: AIProviderConfig,
        _prompt: string,
    ): Promise<RawCompletion> {
        throw new AIProviderError(
            'mammothia',
            'Adaptateur MammothIA non implémenté (endpoint non vérifié).',
        );
    }
    /* eslint-enable @typescript-eslint/no-unused-vars */
}

/** Sérialise le contexte observé à la suite du prompt. Adresse publique seule. */
function buildPrompt(request: AIRequest): string {
    if (!request.context) return request.prompt;

    const parts: string[] = [request.prompt];
    const { tokenData, walletAddress, recentTrades } = request.context;

    if (walletAddress) parts.push(`Adresse publique observée : ${walletAddress}`);
    if (tokenData) parts.push(`Données token : ${JSON.stringify(tokenData)}`);
    if (recentTrades?.length) {
        parts.push(`Transactions récentes : ${JSON.stringify(recentTrades)}`);
    }

    return parts.join('\n\n');
}

export const aiClient = new AIProviderClient();

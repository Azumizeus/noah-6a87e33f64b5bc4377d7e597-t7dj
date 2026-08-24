// src/lib/ai-providers/client.ts
//
// Orchestrateur IA — PROXY ONLY.
// Ce client n'appelle jamais un fournisseur directement. Toute requete part
// vers l'Edge Function Supabase `ai-proxy`, seul endroit qui detient les cles.
//
// Invariant : aucune cle API n'est stockee, lue ou transmise par ce module.

import {
  PROVIDER_FALLBACK_CHAIN,
  type AIProvider,
  type AIRequest,
  type AIResponse,
} from './types';

export class AIProviderClient {
  private proxyBaseUrl = '';
  /** Jeton de session utilisateur (JWT Supabase). Ce n'est PAS une cle IA. */
  private sessionToken = '';

  /**
   * Configure l'URL de l'Edge Function.
   * Exemple : https://<project>.supabase.co/functions/v1/ai-proxy
   */
  setProxyBaseUrl(url: string): void {
    this.proxyBaseUrl = url.replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return this.proxyBaseUrl.length > 0;
  }

  /** Jeton de session Supabase, utilise pour authentifier l'appelant. */
  setSessionToken(token: string): void {
    this.sessionToken = token;
  }

  /** Appel via proxy uniquement. Leve en cas d'echec. */
  async call(request: AIRequest): Promise<AIResponse> {
    if (!this.proxyBaseUrl) {
      throw new Error(
        'Proxy IA non configure. Appeler setProxyBaseUrl() au prealable.',
      );
    }

    const started = Date.now();

    const response = await fetch(`${this.proxyBaseUrl}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.sessionToken
          ? { Authorization: `Bearer ${this.sessionToken}` }
          : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Proxy IA — erreur ${response.status}${detail ? ` : ${detail}` : ''}`,
      );
    }

    const data = (await response.json()) as AIResponse;

    return {
      ...data,
      provider: data.provider ?? request.provider,
      latency: data.latency ?? Date.now() - started,
    };
  }

  /** Appel avec bascule automatique sur la chaine de fallback. */
  async callWithFallback(request: AIRequest): Promise<AIResponse> {
    const errors: string[] = [];

    for (const provider of PROVIDER_FALLBACK_CHAIN) {
      try {
        return await this.call({ ...request, provider });
      } catch (error) {
        errors.push(
          `${provider}: ${error instanceof Error ? error.message : 'erreur inconnue'}`,
        );
      }
    }

    throw new Error(
      `Tous les providers IA ont echoue.\n${errors.join('\n')}`,
    );
  }
}

export const aiClient = new AIProviderClient();

// Auto-configuration depuis l'environnement Vite, si la variable existe.
const envProxyUrl = import.meta.env.VITE_AI_PROXY_URL as string | undefined;
if (envProxyUrl) {
  aiClient.setProxyBaseUrl(envProxyUrl);
}

export type { AIProvider, AIRequest, AIResponse };

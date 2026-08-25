// src/lib/ai-providers/client.ts
//
// Appel DIRECT navigateur -> fournisseur. Aucun intermediaire.
//
// Invariants :
//   - la cle n'est jamais envoyee ailleurs qu'a l'hote du fournisseur choisi,
//   - la cle n'est jamais journalisee, ni dans un message d'erreur,
//   - le corps brut d'une reponse en erreur n'est jamais propage a l'UI.
//
// L'Edge Function `ai-proxy` a ete supprimee : elle impliquait le transit de la
// cle par nos serveurs, ce que l'interface promet explicitement de ne pas faire.

import { PROVIDER_CONFIGS } from './config';
import {
  AIProviderError,
  type AICallOptions,
  type AIMessage,
  type AIProvider,
  type AIResponse,
} from './types';

/** Traduit un code HTTP en message actionnable, sans rien reveler du corps. */
const describeStatus = (status: number): string => {
  if (status === 401 || status === 403) {
    return 'Cle refusee par le fournisseur (401/403). Verifiez la cle et ses droits.';
  }
  if (status === 404) {
    return 'Modele ou endpoint introuvable (404). Verifiez le nom du modele.';
  }
  if (status === 429) {
    return 'Quota ou cadence depasse (429). Reessayez plus tard.';
  }
  if (status === 400 || status === 422) {
    return 'Requete refusee par le fournisseur (400). Modele ou parametres invalides.';
  }
  if (status >= 500) {
    return `Panne cote fournisseur (${status}). Reessayez plus tard.`;
  }
  return `Echec de l'appel (${status}).`;
};

/**
 * Anthropic n'accepte pas `role: "system"` dans `messages` : le prompt systeme
 * est un champ separe. L'y laisser produit un 400 dont le message ne dit pas
 * clairement pourquoi.
 */
const splitSystem = (messages: AIMessage[]) => ({
  system: messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n'),
  chat: messages.filter((m) => m.role !== 'system'),
});

interface AnthropicPayload {
  model: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface OpenAIPayload {
  model: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export const callProvider = async (
  options: AICallOptions,
): Promise<AIResponse> => {
  const { provider, apiKey, messages, signal } = options;
  const config = PROVIDER_CONFIGS[provider];

  if (!config) {
    throw new AIProviderError(provider, 0, 'Fournisseur inconnu.');
  }
  if (!apiKey) {
    throw new AIProviderError(provider, 0, 'Aucune cle disponible pour ce fournisseur.');
  }
  if (messages.length === 0) {
    throw new AIProviderError(provider, 0, 'Aucun message a envoyer.');
  }

  const model = options.model?.trim() || config.defaultModel;
  const temperature = options.temperature ?? config.temperature;
  const maxTokens = options.maxTokens ?? config.maxTokens;
  const started = Date.now();

  let url: string;
  let headers: Record<string, string>;
  let body: string;

  if (provider === 'anthropic') {
    const { system, chat } = splitSystem(messages);
    url = `${config.baseUrl}/messages`;
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Opt-in officiel pour l'appel navigateur. Sans lui, Anthropic n'emet
      // aucun en-tete CORS et la requete echoue avant d'atteindre l'API.
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages: chat,
    });
  } else {
    url = `${config.baseUrl}/chat/completions`;
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(provider === 'openrouter'
        ? { 'HTTP-Referer': window.location.origin, 'X-Title': 'Seeker I' }
        : {}),
    };
    body = JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages,
    });
  }

  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers, body, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AIProviderError(provider, 0, 'Appel annule.');
    }
    // Cas typique : CORS refuse, DNS, hors-ligne. Le detail n'est pas exploitable.
    throw new AIProviderError(
      provider,
      0,
      'Impossible de joindre le fournisseur (reseau ou CORS).',
    );
  }

  if (!response.ok) {
    // Le corps est volontairement lu puis jete : il peut contenir un
    // identifiant d'organisation ou un prefixe de cle.
    void response.text().catch(() => '');
    throw new AIProviderError(provider, response.status, describeStatus(response.status));
  }

  const data: unknown = await response.json().catch(() => null);
  if (!data) {
    throw new AIProviderError(provider, response.status, 'Reponse illisible du fournisseur.');
  }

  if (provider === 'anthropic') {
    const payload = data as AnthropicPayload;
    return {
      provider,
      model: payload.model ?? model,
      content: payload.content?.find((b) => b.type === 'text')?.text ?? '',
      tokens: {
        input: payload.usage?.input_tokens ?? 0,
        output: payload.usage?.output_tokens ?? 0,
      },
      latency: Date.now() - started,
    };
  }

  const payload = data as OpenAIPayload;
  return {
    provider,
    model: payload.model ?? model,
    content: payload.choices?.[0]?.message?.content ?? '',
    tokens: {
      input: payload.usage?.prompt_tokens ?? 0,
      output: payload.usage?.completion_tokens ?? 0,
    },
    latency: Date.now() - started,
  };
};

export { AIProviderError };
export type { AIProvider, AIResponse, AIMessage, AICallOptions };

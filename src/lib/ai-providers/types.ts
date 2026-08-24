// src/lib/ai-providers/types.ts
//
// Abstraction typee pour tous les providers IA.
// Les cles API ne transitent JAMAIS par le client : ni en memoire, ni en
// localStorage, ni dans un header. Elles vivent uniquement dans le vault
// Supabase, lues par l'Edge Function `ai-proxy`.

export type AIProvider =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'opencode'
  | 'mammothia';

export interface AIProviderConfig {
  name: AIProvider;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  // Pas de champ apiKey : la cle vit cote serveur uniquement.
}

export interface AIRequestContext {
  tokenData?: unknown;
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
  /** Duree totale de l'appel, en millisecondes. */
  latency: number;
  error?: string;
}

// Strategie de bascule : primaire -> dernier recours.
export const PROVIDER_FALLBACK_CHAIN: AIProvider[] = [
  'anthropic', // Primary (Claude)
  'openrouter', // Secondary
  'openai', // Tertiary
  'opencode', // Quaternary
  'mammothia', // Last resort
];

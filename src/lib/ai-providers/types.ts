// src/lib/ai-providers/types.ts
//
// Modele BYOK (Bring Your Own Key).
//
// La cle API appartient a l'utilisateur. Elle est :
//   - chiffree au repos (AES-GCM) dans localStorage,
//   - dechiffree en memoire uniquement le temps d'un appel,
//   - transmise DIRECTEMENT au fournisseur choisi, jamais a nos serveurs.
//
// Il n'existe plus d'Edge Function `ai-proxy`. Toute reintroduction d'un relais
// invaliderait la promesse affichee dans l'UI.

export type AIProvider = 'anthropic' | 'openai' | 'openrouter';

export interface AIProviderConfig {
  name: AIProvider;
  label: string;
  /** Racine de l'API du fournisseur. Appelee depuis le navigateur. */
  baseUrl: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  /** Ou obtenir une cle, affiche dans l'UI. */
  keysUrl: string;
  /** Prefixe attendu de la cle — controle de saisie, pas une validation. */
  keyPrefix?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AITokenUsage {
  input: number;
  output: number;
}

export interface AIResponse {
  provider: AIProvider;
  model: string;
  content: string;
  tokens: AITokenUsage;
  /** Duree totale de l'appel, en millisecondes. */
  latency: number;
}

export interface AICallOptions {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Erreur normalisee.
 *
 * `message` est generique et affichable. Le corps brut renvoye par le
 * fournisseur n'est jamais conserve : il contient parfois un identifiant
 * d'organisation ou un prefixe de cle.
 */
export class AIProviderError extends Error {
  readonly provider: AIProvider;
  readonly status: number;

  constructor(provider: AIProvider, status: number, message: string) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.status = status;
  }
}

/** Enregistrement chiffre tel qu'il vit dans localStorage. */
export interface EncryptedKeyRecord {
  provider: AIProvider;
  /** Vecteur d'initialisation AES-GCM, base64. Unique par enregistrement. */
  iv: string;
  /** Chiffre + tag d'authentification, base64. */
  ciphertext: string;
  model: string;
  savedAt: number;
}

export interface AIVaultFile {
  version: number;
  /** Sel HKDF, base64. Genere une fois, conserve en clair (ce n'est pas un secret). */
  salt: string;
  /** Adresse du wallet ayant scelle ce coffre. */
  owner: string;
  records: Record<string, EncryptedKeyRecord>;
}

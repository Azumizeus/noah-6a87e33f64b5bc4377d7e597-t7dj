// src/lib/ai-providers/config.ts
//
// Fournisseurs joignables DIRECTEMENT depuis le navigateur.
//
// Critere d'inclusion unique : l'API renvoie des en-tetes CORS permettant
// l'appel cote client. Un fournisseur qui ne le permet pas exigerait un relais
// serveur — donc le transit de la cle — ce que ce modele exclut.
//
//   anthropic   CORS refuse par defaut, autorise via l'en-tete officiel
//               `anthropic-dangerous-direct-browser-access`. En BYOK la cle est
//               deja dans le navigateur : cet en-tete leve un garde-fou concu
//               pour les applications a cle partagee, il n'ouvre aucune breche.
//   openai      CORS ouvert.
//   openrouter  CORS ouvert, documente pour l'usage navigateur.
//   mammouth    API 100% compatible OpenAI : seule la racine change
//               (https://api.mammouth.ai/v1/chat/completions). Leur
//               documentation ne se prononce pas sur CORS ; si l'appel
//               navigateur est refuse, l'erreur remonte comme "reseau ou CORS"
//               et il faudra retirer ce fournisseur ou passer par OpenRouter.
//
// Volontairement absent :
//   opencode — retire sur decision produit.

import type { AIProvider, AIProviderConfig } from './types';

export const PROVIDER_CONFIGS: Record<AIProvider, AIProviderConfig> = {
  anthropic: {
    name: 'anthropic',
    label: 'Anthropic — Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    temperature: 0.7,
    keysUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
  },
  openai: {
    name: 'openai',
    label: 'OpenAI — GPT',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    maxTokens: 2048,
    temperature: 0.7,
    keysUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
  },
  openrouter: {
    name: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4',
    maxTokens: 2048,
    temperature: 0.7,
    keysUrl: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-',
  },
  mammouth: {
    name: 'mammouth',
    label: 'Mammouth.ai',
    baseUrl: 'https://api.mammouth.ai/v1',
    defaultModel: 'gpt-4o',
    maxTokens: 2048,
    temperature: 0.7,
    keysUrl: 'https://mammouth.ai',
    // Pas de prefixe impose documente : aucun controle de saisie, sinon on
    // rejetterait des cles valides.
  },
};

export const PROVIDER_LIST = Object.keys(PROVIDER_CONFIGS) as AIProvider[];

export const isAIProvider = (value: string): value is AIProvider =>
  Object.prototype.hasOwnProperty.call(PROVIDER_CONFIGS, value);

export const getDefaultModel = (provider: AIProvider): string =>
  PROVIDER_CONFIGS[provider].defaultModel;

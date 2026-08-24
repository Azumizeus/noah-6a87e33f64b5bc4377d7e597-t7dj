// src/lib/ai-providers/config.ts
//
// Configuration statique des fournisseurs. Aucune clé API ici : les clés ne
// sont jamais en dur, jamais dans le bundle, jamais dans le dépôt.

import type { AIProvider, AIProviderConfig } from './types';

export const PROVIDER_CONFIGS: Record<AIProvider, AIProviderConfig> = {
    anthropic: {
        name: 'anthropic',
        label: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 2048,
        temperature: 0.7,
        // L'API Anthropic refuse les appels navigateur (CORS) sans opt-in
        // explicite, qui exposerait la clé. Le relais serveur est obligatoire.
        requiresServerProxy: true,
    },
    openrouter: {
        name: 'openrouter',
        label: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4o',
        maxTokens: 2048,
        temperature: 0.7,
    },
    openai: {
        name: 'openai',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        maxTokens: 2048,
        temperature: 0.7,
        requiresServerProxy: true,
    },
    opencode: {
        name: 'opencode',
        label: 'OpenCode',
        // Endpoint non vérifié — à confirmer avant toute activation.
        baseUrl: '',
        model: 'opencode-latest',
        maxTokens: 2048,
        temperature: 0.7,
        unverified: true,
        requiresServerProxy: true,
    },
    mammothia: {
        name: 'mammothia',
        label: 'MammothIA',
        // Endpoint non vérifié — à confirmer avant toute activation.
        baseUrl: '',
        model: 'mammoth-large',
        maxTokens: 2048,
        temperature: 0.7,
        unverified: true,
        requiresServerProxy: true,
    },
};

export const PROVIDER_LIST: AIProvider[] = Object.keys(
    PROVIDER_CONFIGS,
) as AIProvider[];

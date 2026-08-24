// supabase/functions/ai-proxy/index.ts
//
// STUB — documentation d'architecture. NON DEPLOYE.
// Implementation reelle prevue en Phase 3 (moteur SAGE).
//
// Cette fonction est le SEUL endroit du systeme qui manipule une cle API de
// fournisseur IA. Le navigateur n'en voit jamais aucune.
//
// Points a traiter avant deploiement :
//  - Authentifier l'appelant (JWT Supabase) et refuser les appels anonymes.
//  - Verifier le Pass on-chain de l'utilisateur avant d'autoriser un appel.
//  - Rate limiting par utilisateur, sinon la cle est un budget ouvert.
//  - Ne jamais renvoyer la cle, ni la loguer, ni l'inclure dans une erreur.
//  - Chaque fournisseur a un chemin, un schema de requete et un schema de
//    reponse differents : un adapter par fournisseur est necessaire.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AIProvider =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'opencode'
  | 'mammothia';

// TODO Phase 3 : chemins et schemas exacts a confirmer par fournisseur.
// Ne PAS deriver une URL depuis le nom du provider — les domaines different.
const PROVIDER_ENDPOINTS: Record<AIProvider, string | null> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  opencode: null, // endpoint non verifie
  mammothia: null, // endpoint non verifie
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { provider, prompt } = (await req.json()) as {
    provider: AIProvider;
    prompt: string;
  };

  const endpoint = PROVIDER_ENDPOINTS[provider];
  if (!endpoint) {
    return new Response(
      JSON.stringify({ error: `Provider non supporte : ${provider}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // TODO Phase 3 : verifier le JWT de l'appelant et son Pass on-chain ici,
  // AVANT toute lecture de secret.

  // Lecture du secret chiffre at-rest. Jamais renvoye au client.
  const { data: secret } = await supabase
    .from('ai_secrets')
    .select('key')
    .eq('provider', provider)
    .single();

  if (!secret) {
    return new Response(
      JSON.stringify({ error: 'Provider non configure' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // TODO Phase 3 : adapter le corps de requete et le parsing de reponse
  // au schema propre a chaque fournisseur, puis normaliser vers AIResponse.
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': secret.key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  const payload = await upstream.text();

  return new Response(payload, {
    status: upstream.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});

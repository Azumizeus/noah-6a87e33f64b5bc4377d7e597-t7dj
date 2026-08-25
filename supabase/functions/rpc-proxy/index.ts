// supabase/functions/rpc-proxy/index.ts
//
// Relais RPC Solana. La cle Helius vit UNIQUEMENT ici, dans les secrets
// Supabase. Le navigateur ne connait que l'URL de cette fonction.
//
// Regles :
//  - Whitelist de methodes. Tout le reste renvoie 403.
//  - Aucune methode d'ecriture privilegiee : le programme ne detient pas de
//    fonds et la fonction ne signe rien. Elle relaie des octets, rien de plus.
//  - La cle n'est jamais renvoyee, jamais loguee, jamais incluse dans une erreur.
//
// Secrets a definir cote Supabase (Settings > Edge Functions > Secrets) :
//   HELIUS_API_KEY      cle Helius
//   SOLANA_CLUSTER      "devnet" (defaut) ou "mainnet"

import { serve } from 'https://deno.land/std@0.208.1/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

const HELIUS_KEY = Deno.env.get('HELIUS_API_KEY') ?? '';
const CLUSTER = (Deno.env.get('SOLANA_CLUSTER') ?? 'devnet').toLowerCase();

const HELIUS_HOST =
  CLUSTER === 'mainnet' || CLUSTER === 'mainnet-beta'
    ? 'https://mainnet.helius-rpc.com'
    : 'https://devnet.helius-rpc.com';

const UPSTREAM_URL = `${HELIUS_HOST}/?api-key=${HELIUS_KEY}`;

// Methodes autorisees.
//
// Attention : une whitelist trop etroite casse le wallet-adapter de facon
// opaque. getLatestBlockhash, sendTransaction et getSignatureStatuses sont
// indispensables — sans elles aucune transaction ne part et l'erreur remontee
// au client ne dit pas pourquoi.
const ALLOWED_METHODS = new Set([
  // Lecture de comptes et de soldes
  'getAccountInfo',
  'getMultipleAccounts',
  'getProgramAccounts',
  'getBalance',
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getParsedTokenAccountsByOwner',
  'getMinimumBalanceForRentExemption',

  // Cycle de vie d'une transaction (requis par @solana/web3.js)
  'getLatestBlockhash',
  'getFeeForMessage',
  'simulateTransaction',
  'sendTransaction',
  'getSignatureStatuses',
  'getSignaturesForAddress',
  'getTransaction',

  // Divers
  'getSlot',
  // Horloge du cluster — utilisee pour evaluer l'expiration d'un Pass sans
  // faire confiance a l'horloge du poste, que l'utilisateur peut modifier.
  'getBlockTime',
  'getBlockHeight',
  'getGenesisHash',
  'getVersion',
  'getHealth',
]);

interface JsonRpcCall {
  jsonrpc?: string;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

const rejection = (id: unknown, message: string) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code: -32601, message },
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  if (!HELIUS_KEY) {
    // On ne divulgue pas la cause exacte cote client.
    console.error('[rpc-proxy] HELIUS_API_KEY absent des secrets');
    return new Response(JSON.stringify({ error: 'RPC unavailable' }), {
      status: 503,
      headers: JSON_HEADERS,
    });
  }

  let body: JsonRpcCall | JsonRpcCall[];
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // web3.js regroupe parfois plusieurs appels dans un seul tableau JSON-RPC.
  // Un proxy qui ne gere que l'objet unique casse silencieusement ces lots.
  const calls = Array.isArray(body) ? body : [body];

  const blocked = calls.find(
    (call) => typeof call?.method !== 'string' || !ALLOWED_METHODS.has(call.method as string),
  );

  if (blocked) {
    return new Response(
      JSON.stringify(
        rejection(blocked.id, `Method not allowed: ${String(blocked.method)}`),
      ),
      { status: 403, headers: JSON_HEADERS },
    );
  }

  const upstream = await fetch(UPSTREAM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await upstream.text();

  return new Response(payload, {
    status: upstream.status,
    headers: JSON_HEADERS,
  });
});

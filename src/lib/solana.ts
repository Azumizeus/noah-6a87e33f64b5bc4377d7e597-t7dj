// src/lib/solana.ts
//
// Point d'entree unique pour la configuration Solana du front.
//
// L'endpoint RPC pointe vers l'Edge Function `rpc-proxy`, jamais vers Helius
// directement : tout ce qui porte le prefixe VITE_ est inscrit en clair dans
// le bundle et devient public au premier deploiement.

import { PublicKey } from '@solana/web3.js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? '';

/** Cluster cible, purement informatif cote client — le relais tranche. */
export const SOLANA_CLUSTER =
  (import.meta.env.VITE_SOLANA_NETWORK as string) || 'devnet';

/**
 * Endpoint RPC.
 * Repli sur le RPC public uniquement si Supabase n'est pas configure (dev
 * local sans backend). Le RPC public rate-limite (429) tres vite.
 */
export const RPC_ENDPOINT = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/rpc-proxy`
  : 'https://api.devnet.solana.com';

export const USES_RPC_PROXY = Boolean(SUPABASE_URL);

/**
 * En-tetes exiges par Supabase Edge Functions.
 * Sans `apikey` + `Authorization`, la passerelle repond 401 avant meme
 * d'atteindre la fonction — et l'erreur remonte au wallet-adapter sous une
 * forme illisible.
 */
export const RPC_HEADERS: Record<string, string> = USES_RPC_PROXY
  ? {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    }
  : {};

// --------------------------------------------------------------- access_gate

export const ACCESS_GATE_PROGRAM_ID = new PublicKey(
  'CsQC1gyKSdxJo4P9e6iaXgEwgwTw3kZYyiv89yzGZnXX',
);

/** Config PDA — seeds ["config", authority]. */
export const deriveConfigPda = (authority: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('config'), authority.toBuffer()],
    ACCESS_GATE_PROGRAM_ID,
  )[0];

/** Pass PDA — seeds ["pass", owner]. */
export const derivePassPda = (owner: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('pass'), owner.toBuffer()],
    ACCESS_GATE_PROGRAM_ID,
  )[0];

/** PaymentMint PDA — seeds ["mint", mint]. */
export const derivePaymentMintPda = (mint: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('mint'), mint.toBuffer()],
    ACCESS_GATE_PROGRAM_ID,
  )[0];

/** Durees de tier, en secondes. Constantes du programme — non modifiables. */
export const TIER_DURATIONS = [604_800, 2_592_000] as const;

/**
 * Miroir exact de `is_pass_valid` cote programme.
 * `now` doit provenir du cluster, pas de l'horloge locale : un client peut
 * changer sa date systeme, pas le Clock on-chain.
 */
export const isPassValid = (expiresAt: number, now: number): boolean =>
  expiresAt > now;

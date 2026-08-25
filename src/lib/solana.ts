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

const EXPLICIT_RPC = (import.meta.env.VITE_SOLANA_RPC_URL as string) ?? '';

/**
 * Endpoint RPC.
 *
 * Priorite : VITE_SOLANA_RPC_URL si defini (doit pointer vers rpc-proxy),
 * sinon deduit de l'URL Supabase, sinon repli sur le RPC public.
 * Le repli public rate-limite (429) tres vite — c'est un filet de dev local,
 * pas une configuration de production.
 */
export const RPC_ENDPOINT =
  EXPLICIT_RPC ||
  (SUPABASE_URL
    ? `${SUPABASE_URL}/functions/v1/rpc-proxy`
    : 'https://api.devnet.solana.com');

/**
 * Vrai uniquement si l'endpoint est bien une Edge Function Supabase.
 * Envoyer les en-tetes Supabase vers un RPC tiers serait au mieux inutile,
 * au pire une fuite de la cle anon vers un domaine non maitrise.
 */
export const USES_RPC_PROXY =
  RPC_ENDPOINT.includes('.supabase.co/functions/v1/');

/**
 * En-tetes exiges par Supabase Edge Functions.
 * Sans `apikey` + `Authorization`, la passerelle repond 401 avant meme
 * d'atteindre la fonction — et l'erreur remonte au wallet-adapter sous une
 * forme illisible.
 */
export const RPC_HEADERS: Record<string, string> =
  USES_RPC_PROXY && SUPABASE_ANON_KEY
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

// src/hooks/usePassStatus.ts
//
// Lecture on-chain du Pass access_gate.
//
// Portee : cette verification pilote l'AFFICHAGE. Elle ne constitue pas un
// controle de securite — le navigateur est un environnement hostile, et de
// toute facon un utilisateur qui detient sa propre cle API peut appeler le
// fournisseur sans passer par l'app. Le seul point d'autorite reste le
// programme on-chain.
//
// Deserialisation manuelle plutot qu'Anchor : le compte Pass fait 94 octets a
// disposition fixe, et charger un Provider Anchor juste pour lire un i64 est
// disproportionne.

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

import { derivePassPda } from '@/lib/solana';

// Disposition du compte (Anchor) :
//   0..8    discriminateur
//   8       bump               u8
//   9..41   owner              Pubkey
//   41..73  config             Pubkey
//   73      tier               u8
//   74..82  expires_at         i64 little-endian
//   82..90  last_purchase_at   i64
//   90..94  total_purchases    u32
const OFFSET_TIER = 73;
const OFFSET_EXPIRES_AT = 74;
const PASS_MIN_LEN = 94;

export interface PassStatus {
  loading: boolean;
  /** Aucun compte Pass n'existe pour ce wallet. */
  exists: boolean;
  valid: boolean;
  tier: number | null;
  expiresAt: number | null;
  refresh: () => void;
}

export const usePassStatus = (): PassStatus => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [loading, setLoading] = useState(false);
  const [exists, setExists] = useState(false);
  const [valid, setValid] = useState(false);
  const [tier, setTier] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;

    if (!publicKey) {
      setExists(false);
      setValid(false);
      setTier(null);
      setExpiresAt(null);
      return;
    }

    setLoading(true);

    void (async () => {
      try {
        const account = await connection.getAccountInfo(derivePassPda(publicKey));

        if (!active) return;

        if (!account || account.data.length < PASS_MIN_LEN) {
          setExists(false);
          setValid(false);
          setTier(null);
          setExpiresAt(null);
          return;
        }

        const view = new DataView(
          account.data.buffer,
          account.data.byteOffset,
          account.data.byteLength,
        );

        // getBigInt64 : expires_at est un i64. Le lire en deux u32 ou via
        // Number() sur un buffer mal aligne donne une date fausse.
        const expiry = Number(view.getBigInt64(OFFSET_EXPIRES_AT, true));

        // Horloge du cluster de preference a celle du poste, qui est
        // modifiable par l'utilisateur.
        let now = Math.floor(Date.now() / 1000);
        try {
          const slot = await connection.getSlot();
          const blockTime = await connection.getBlockTime(slot);
          if (blockTime) now = blockTime;
        } catch {
          // RPC restreint ou indisponible : repli sur l'horloge locale.
        }

        if (!active) return;

        setExists(true);
        setTier(account.data[OFFSET_TIER]);
        setExpiresAt(expiry);
        setValid(expiry > now);
      } catch {
        if (!active) return;
        setExists(false);
        setValid(false);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [connection, publicKey, nonce]);

  return { loading, exists, valid, tier, expiresAt, refresh };
};

export default usePassStatus;

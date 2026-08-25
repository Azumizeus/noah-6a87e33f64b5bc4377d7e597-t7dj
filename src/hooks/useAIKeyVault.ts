// src/hooks/useAIKeyVault.ts
//
// Etat React du coffre de cles IA.
//
// La cle AES derivee vit dans une ref, jamais dans le state : un state est
// serialise par les outils de debug React et peut se retrouver dans un
// enregistrement de session. Elle est effacee au verrouillage, au changement
// de wallet et a la deconnexion.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

import { deriveVaultKey, fromBase64, open, seal, vaultChallenge } from '@/lib/ai-providers/crypto';
import {
  listRecords,
  loadVault,
  putRecord,
  purgeVault,
  removeRecord,
  saveVault,
} from '@/lib/ai-providers/vault';
import { getDefaultModel } from '@/lib/ai-providers/config';
import type { AIProvider, AIVaultFile, EncryptedKeyRecord } from '@/lib/ai-providers/types';

export interface AIKeyVault {
  /** Wallet connecte ET signature obtenue : le coffre peut chiffrer/dechiffrer. */
  unlocked: boolean;
  unlocking: boolean;
  /** Le wallet connecte sait-il signer un message hors transaction. */
  canSign: boolean;
  records: EncryptedKeyRecord[];
  error: string | null;
  unlock: () => Promise<boolean>;
  lock: () => void;
  saveKey: (provider: AIProvider, apiKey: string, model?: string) => Promise<void>;
  revealKey: (provider: AIProvider) => Promise<string>;
  deleteKey: (provider: AIProvider) => void;
  purge: () => void;
}

export const useAIKeyVault = (): AIKeyVault => {
  const { publicKey, connected, signMessage } = useWallet();
  const owner = publicKey?.toBase58() ?? '';

  const keyRef = useRef<CryptoKey | null>(null);
  const [vault, setVault] = useState<AIVaultFile>(() => loadVault(owner));
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Changement de wallet ou deconnexion : on relit le coffre et on jette la
  // cle. Sans cela, un wallet B heriterait de la session dechiffree de A.
  useEffect(() => {
    keyRef.current = null;
    setUnlocked(false);
    setError(null);
    setVault(loadVault(owner));
  }, [owner]);

  const lock = useCallback(() => {
    keyRef.current = null;
    setUnlocked(false);
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (!connected || !owner) {
      setError('Connectez un wallet pour ouvrir le coffre.');
      return false;
    }
    if (!signMessage) {
      setError("Ce wallet ne prend pas en charge la signature de message.");
      return false;
    }

    setUnlocking(true);
    setError(null);

    try {
      const current = loadVault(owner);
      const signature = await signMessage(
        new TextEncoder().encode(vaultChallenge(owner)),
      );

      keyRef.current = await deriveVaultKey(
        signature,
        fromBase64(current.salt),
        owner,
      );

      // Premier deverrouillage : on fige le sel genere, sinon un sel different
      // serait tire a chaque session et rien ne serait relisible.
      saveVault(current);
      setVault(current);
      setUnlocked(true);
      return true;
    } catch {
      keyRef.current = null;
      setUnlocked(false);
      setError('Signature refusee ou impossible. Coffre non ouvert.');
      return false;
    } finally {
      setUnlocking(false);
    }
  }, [connected, owner, signMessage]);

  const saveKey = useCallback(
    async (provider: AIProvider, apiKey: string, model?: string) => {
      const key = keyRef.current;
      if (!key) throw new Error('Coffre verrouille.');

      const sealed = await seal(key, apiKey.trim());
      setVault((current) =>
        putRecord(current, {
          provider,
          iv: sealed.iv,
          ciphertext: sealed.ciphertext,
          model: model?.trim() || getDefaultModel(provider),
          savedAt: Date.now(),
        }),
      );
    },
    [],
  );

  const revealKey = useCallback(
    async (provider: AIProvider): Promise<string> => {
      const key = keyRef.current;
      if (!key) throw new Error('Coffre verrouille.');

      const record = vault.records[provider];
      if (!record) throw new Error('Aucune cle enregistree pour ce fournisseur.');

      try {
        return await open(key, { iv: record.iv, ciphertext: record.ciphertext });
      } catch {
        // AES-GCM authentifie : l'echec signifie mauvaise cle ou blob altere.
        throw new Error('Dechiffrement impossible. Coffre lie a un autre wallet ?');
      }
    },
    [vault],
  );

  const deleteKey = useCallback((provider: AIProvider) => {
    setVault((current) => removeRecord(current, provider));
  }, []);

  const purge = useCallback(() => {
    purgeVault(owner);
    keyRef.current = null;
    setUnlocked(false);
    setVault(loadVault(owner));
  }, [owner]);

  return {
    unlocked,
    unlocking,
    canSign: Boolean(signMessage),
    records: listRecords(vault),
    error,
    unlock,
    lock,
    saveKey,
    revealKey,
    deleteKey,
    purge,
  };
};

export default useAIKeyVault;

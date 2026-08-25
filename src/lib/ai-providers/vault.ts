// src/lib/ai-providers/vault.ts
//
// Persistance du coffre de cles IA dans localStorage.
//
// Ce module ne manipule que des blobs chiffres. Il n'a aucun acces au clair :
// le dechiffrement se fait dans `useAIKeyVault`, avec une cle qui n'existe
// qu'en memoire.
//
// Un coffre est lie a une adresse de wallet. Changer de wallet donne un coffre
// distinct — sans quoi un utilisateur B pourrait voir les enregistrements de A
// sur un poste partage.

import { isAIProvider } from './config';
import type { AIProvider, AIVaultFile, EncryptedKeyRecord } from './types';
import { randomBytes, toBase64 } from './crypto';

const VAULT_VERSION = 1;
const STORAGE_PREFIX = 'seeker_ai_vault_v1';

const storageKey = (owner: string) => `${STORAGE_PREFIX}:${owner}`;

const emptyVault = (owner: string): AIVaultFile => ({
  version: VAULT_VERSION,
  salt: toBase64(randomBytes(32)),
  owner,
  records: {},
});

/**
 * Charge le coffre. Cree un coffre vide si absent, illisible ou de version
 * inconnue — on ne tente jamais de migrer un blob qu'on ne comprend pas.
 */
export const loadVault = (owner: string): AIVaultFile => {
  if (!owner) return emptyVault('');

  try {
    const raw = localStorage.getItem(storageKey(owner));
    if (!raw) return emptyVault(owner);

    const parsed = JSON.parse(raw) as AIVaultFile;
    if (parsed.version !== VAULT_VERSION || parsed.owner !== owner) {
      return emptyVault(owner);
    }
    if (typeof parsed.salt !== 'string' || !parsed.records) {
      return emptyVault(owner);
    }
    return parsed;
  } catch {
    return emptyVault(owner);
  }
};

export const saveVault = (vault: AIVaultFile): void => {
  if (!vault.owner) return;
  localStorage.setItem(storageKey(vault.owner), JSON.stringify(vault));
};

export const putRecord = (
  vault: AIVaultFile,
  record: EncryptedKeyRecord,
): AIVaultFile => {
  const next: AIVaultFile = {
    ...vault,
    records: { ...vault.records, [record.provider]: record },
  };
  saveVault(next);
  return next;
};

export const removeRecord = (
  vault: AIVaultFile,
  provider: AIProvider,
): AIVaultFile => {
  const records = { ...vault.records };
  delete records[provider];
  const next: AIVaultFile = { ...vault, records };
  saveVault(next);
  return next;
};

/** Efface tout le coffre de ce wallet. Irreversible. */
export const purgeVault = (owner: string): void => {
  if (!owner) return;
  localStorage.removeItem(storageKey(owner));
};

/**
 * Metadonnees affichables sans dechiffrer : fournisseur, modele, date.
 * Aucun fragment de cle n'est expose — pas meme les derniers caracteres, qui
 * facilitent la correlation en cas de fuite partielle.
 */
export const listRecords = (vault: AIVaultFile): EncryptedKeyRecord[] =>
  Object.values(vault.records)
    .filter((record) => isAIProvider(record.provider))
    .sort((a, b) => a.provider.localeCompare(b.provider));

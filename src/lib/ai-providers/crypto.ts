// src/lib/ai-providers/crypto.ts
//
// Chiffrement local des cles API. WebCrypto uniquement, aucune dependance.
//
// Chaine de derivation :
//
//   signature Ed25519 du wallet (64 octets)
//        |  HKDF-SHA256, sel aleatoire 32 octets + info liee a l'adresse
//        v
//   cle AES-GCM 256 bits, non extractible, en memoire seulement
//        |  AES-GCM, IV aleatoire 96 bits par enregistrement
//        v
//   blob chiffre en localStorage
//
// Pourquoi une signature plutot qu'un mot de passe : elle est deterministe
// (Ed25519, RFC 8032 — meme message, meme cle, meme signature), donc
// reproductible a chaque session sans rien stocker de secret. Et elle lie le
// coffre au wallet : un autre wallet ne peut pas dechiffrer.
//
// Ce que cela protege : lecture du localStorage par une extension, un backup
// disque, un autre profil navigateur.
// Ce que cela ne protege pas : une XSS active pendant que le coffre est
// deverrouille — la cle AES est alors en memoire dans l'onglet. Aucun schema
// purement client ne resout ce cas.

const HKDF_INFO_PREFIX = 'seeker-i/ai-vault/v1';

/** Message signe pour deriver la cle. Toute modification invalide les coffres existants. */
export const vaultChallenge = (walletAddress: string): string =>
  [
    'Seeker I — coffre de cles IA',
    '',
    "Signer ce message derive la cle qui dechiffre vos cles API stockees",
    'localement dans ce navigateur.',
    '',
    "Ce n'est pas une transaction. Aucun transfert, aucun frais.",
    '',
    `Wallet : ${walletAddress}`,
    'Version : 1',
  ].join('\n');

// ------------------------------------------------------------------ base64

export const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const randomBytes = (length: number): Uint8Array =>
  crypto.getRandomValues(new Uint8Array(length));

// ---------------------------------------------------------------- derivation

/**
 * Derive la cle AES-GCM depuis la signature du wallet.
 * `extractable: false` : la cle ne peut plus etre exportee, meme par du code
 * s'executant dans la page. Le materiau brut n'est jamais serialisable.
 */
export const deriveVaultKey = async (
  signature: Uint8Array,
  salt: Uint8Array,
  walletAddress: string,
): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    'raw',
    // Copie explicite : WebCrypto exige un ArrayBuffer, pas une vue partielle.
    signature.slice().buffer,
    'HKDF',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.slice().buffer,
      info: new TextEncoder().encode(`${HKDF_INFO_PREFIX}:${walletAddress}`),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

// ------------------------------------------------------------- chiffrement

export interface SealedValue {
  iv: string;
  ciphertext: string;
}

export const seal = async (
  key: CryptoKey,
  plaintext: string,
): Promise<SealedValue> => {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
};

/**
 * Leve si la cle est mauvaise ou le blob altere : AES-GCM authentifie le
 * chiffre, une modification d'un seul octet fait echouer le dechiffrement.
 */
export const open = async (
  key: CryptoKey,
  sealed: SealedValue,
): Promise<string> => {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv) },
    key,
    fromBase64(sealed.ciphertext).slice().buffer,
  );

  return new TextDecoder().decode(decrypted);
};

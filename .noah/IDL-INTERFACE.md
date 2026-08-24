# Interface IDL — référence TypeScript générique

Ce document décrit la forme attendue de l'intégration. Il ne remplace pas l'IDL générée par Anchor. Les noms, types, discriminants et adresses de l'IDL réelle sont la source de vérité.

## Principes

- Importer l'IDL et le type du programme depuis `src/lib/`.
- Construire les PDA avec les seeds documentées, jamais avec une adresse codée en dur non vérifiée.
- Ne pas accepter `now` ou `expiresAt` fourni par le navigateur.
- Ne jamais loguer une clé privée, une seed phrase ou une clé IA.
- La transaction doit être signée par le wallet de l'utilisateur et confirmée sur le réseau configuré.

## Exemple de types

```ts
import type { Idl, AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import idlJson from "./access_gate.json";

export type AccessGateIdl = Idl & {
  address: string;
  instructions: unknown[];
  accounts?: unknown[];
};

export type PassTier = 1 | 2;
export type PaymentKind = "nativeSol" | "spl";

export interface PassView {
  owner: PublicKey;
  tier: PassTier;
  expiresAt: number;
  lastPurchaseAt: number;
  totalPurchases: number;
}

export function deriveConfigPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId,
  )[0];
}

export function derivePassPda(
  programId: PublicKey,
  owner: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pass"), owner.toBuffer()],
    programId,
  )[0];
}

export function derivePaymentMintPda(
  programId: PublicKey,
  mint: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint"), mint.toBuffer()],
    programId,
  )[0];
}
```

## Exemple de lecture

```ts
export async function readPass(
  program: Program<AccessGateIdl>,
  owner: PublicKey,
): Promise<PassView | null> {
  const address = derivePassPda(program.programId, owner);

  try {
    const account = await program.account.pass.fetch(address);
    return {
      owner: account.owner,
      tier: Number(account.tier) as PassTier,
      expiresAt: Number(account.expiresAt),
      lastPurchaseAt: Number(account.lastPurchaseAt),
      totalPurchases: Number(account.totalPurchases),
    };
  } catch {
    return null;
  }
}
```

## Exemple de transaction

```ts
export async function purchasePass(
  program: Program<AccessGateIdl>,
  owner: PublicKey,
  tier: PassTier,
  paymentMint: PublicKey,
  paymentKind: PaymentKind,
): Promise<string> {
  const config = deriveConfigPda(program.programId);
  const pass = derivePassPda(program.programId, owner);
  const mintConfig = derivePaymentMintPda(program.programId, paymentMint);

  // Le montant final, les décimales, l'oracle et l'expiration sont validés
  // par le programme. Aucun timestamp client ne doit être envoyé.
  const builder = program.methods
    .purchasePass(tier)
    .accounts({
      owner,
      config,
      pass,
      paymentMintConfig: mintConfig,
      // Ajouter ici les comptes exacts de l'IDL : treasury, feed, token
      // program, ATA ou system program selon paymentKind.
      systemProgram: SystemProgram.programId,
    });

  // Ajouter les comptes SPL/Pyth exacts selon l'IDL générée et le paiement.
  void paymentKind;
  return builder.rpc();
}
```

## Contrat d'intégration UI

Une page ou un composant doit :

1. vérifier wallet connecté et réseau attendu ;
2. charger le `Pass` et afficher une date convertie localement ;
3. expliquer le tier, le prix affiché et les risques de transaction ;
4. afficher loading pendant la signature et la confirmation ;
5. afficher la signature et le lien Explorer en succès ;
6. afficher une erreur actionnable sans exposer de secret ;
7. rafraîchir l'état on-chain après confirmation.

L'intégration doit rester dans les modules Vite existants : pages, composants et librairie Solana. Aucun chemin d'application parallèle ne doit être créé.

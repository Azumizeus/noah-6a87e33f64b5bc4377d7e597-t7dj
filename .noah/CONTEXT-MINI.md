# Seeker I — Contexte Noah (Vite + Anchor)

## Mission

Seeker I est un dashboard Solana d'analyse et de pilotage. Le produit reste self-custody : aucun fonds, secret de wallet ou seed phrase n'est conservé. Il n'existe aucun mécanisme de token créé par le projet, de rendement ou d'abonnement auto-débité. Les Pass d'accès sont à durée fixe et chaque achat exige une signature fraîche du wallet.

Objectif v1 : livrer d'abord une PWA Web EN/FR, puis une enveloppe mobile. Toujours privilégier un découpage fin, testable et réversible.

## Arborescence réelle

- `src/` : application Vite + React + TypeScript.
- `src/pages/` : pages et routes React.
- `src/components/` : composants UI réutilisables.
- `src/lib/` : clients Solana, helpers PDA, IDL et logique d'intégration.
- `programs/` : emplacement Anchor CLI du programme Rust `access_gate`.
- `.noah/` : contexte, checklist et interface de référence.
- `docs/` : roadmap et glossaire.

L'application Web reste directement sous `src/`. Ne crée pas manuellement un chemin de programme alternatif : Anchor CLI utilise `programs/`.

## Stack verrouillée

- Web : Vite, React, TypeScript, React Router, react-i18next.
- Chaîne : Solana, Anchor/Rust, un seul programme `access_gate`.
- Données : Helius RPC/Webhooks et Supabase Edge Functions.
- Wallet : Wallet Adapter sur Web ; Mobile Wallet Adapter plus tard.
- IA : BYOK côté serveur ; les clés restent chiffrées côté serveur et ne sont jamais renvoyées au navigateur.
- Qualité : TypeScript strict, tests unitaires et tests Anchor, Sentry sans données sensibles.

## Moteurs fonctionnels

- **SKYLINE** : radar de pools, whale tracking, signaux de risque/rug.
- **SIBYL** : analyse descriptive, indicateurs de risque et sentiment.
- **VELOCITY** : exécution volontairement séparée, Jupiter et contrôles de slippage.
- **CITADEL** : Pass T0/T1/T2, PDA d'expiration et paiement atomique.
- **SAGE** : orchestration IA côté serveur, jamais de clé fournisseur dans le client.

## Contrat on-chain attendu

PDA `Config` : `["config"]`.
PDA `PaymentMint` : `["mint", mint]`.
PDA `Pass` : `["pass", owner]`.

Instructions principales : `initialize_config`, `update_config`, `set_treasury`, `upsert_payment_mint`, `set_payment_mint_enabled`, `set_paused`, `purchase_pass`.

Règles inviolables :

1. L'expiration vient uniquement de `Clock::get()?.unix_timestamp` et d'une durée de configuration.
2. `owner` est signataire et correspond à la PDA `Pass`.
3. Aucun compte utilisateur n'est détenu par le programme ; aucun `approve`, refund, revoke ou retrait de trésorerie on-chain.
4. Le mint, le programme de tokens, le feed Pyth, la fraîcheur et l'intervalle de confiance sont vérifiés.
5. L'autorité de production est un multi-sig ; le guardian ne peut que mettre en pause.

## Règles Noah

- Travailler dans un seul projet Noah et conserver le dépôt exporté comme source de vérité.
- Télécharger et archiver l'IDL et le keypair de déploiement dès qu'ils sont générés ; ne jamais demander ni coller une clé privée.
- Mentionner l'IDL exact ou les fichiers concernés dans chaque demande d'intégration.
- Modifier par petites étapes : interface, SDK, puis branchement d'un bouton précis.
- Ne jamais remplacer une transaction réelle par un mock silencieux.
- Afficher l'état loading, l'erreur, la signature et le lien Explorer après une transaction.
- Devnet avant toute hypothèse mainnet ; aucune adresse, feed ou mint ne doit être inventé.

## Vocabulaire produit et conformité

Employer « indicateurs », « signaux », « niveaux de risque » et « données observées ». Ne jamais promettre une performance, une opportunité ou un rendement. Afficher en permanence : **« Outil d'analyse, pas un conseil en investissement. »**

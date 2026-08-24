# Seeker I — Roadmap courte

> Solana · self-custody · Web EN/FR. Le projet ne conserve pas les fonds des utilisateurs et ne promet aucun rendement.

## Phase 1 — Fondations

- Stabiliser le dépôt Vite + React + TypeScript et le design system.
- Mettre en place routes, wallet, i18n EN/FR, états d'erreur et disclaimer.
- Développer `access_gate` avec Anchor/Rust : PDA `Config`, `PaymentMint`, `Pass`, expiration on-chain et achats atomiques.
- Écrire les tests de sécurité et de logique ; générer et archiver l'IDL.
- Connecter une lecture de Pass puis un achat Devnet avec confirmation Explorer.
- Documenter les décisions, adresses de réseau et risques ouverts.

**Sortie :** un socle reproductible, auditable et testable sur Devnet.

## Phase 2 — Trading core

- SKYLINE : données de pools, suivi des wallets observés et signaux de risque.
- VELOCITY : intégration Jupiter avec simulation, slippage explicite et contrôles d'erreur.
- Portfolio : soldes et historique de transactions sans custody.
- UI : cartes de données, panneau d'action, niveaux d'accès et états temps réel.
- Backend : webhooks, cache contrôlé et séparation stricte des secrets.

**Sortie :** dashboard utile en lecture et parcours d'exécution signé par l'utilisateur.

## Phase 3 — Intelligence

- SIBYL : indicateurs descriptifs, score de risque explicable et sentiment sourcé.
- SAGE : orchestration serveur, BYOK chiffré, fournisseur primaire et fallback.
- LINGUA : messages EN/FR cohérents et glossaire produit.
- Observabilité : métriques, Sentry filtré et tests de non-divulgation.

**Sortie :** analyse assistée sans formulation prédictive et sans clé IA côté client.

## Garde-fous permanents

- Aucun token créé par le projet, aucune tokenomics, aucun mécanisme de rendement.
- Aucun accès aux clés privées, aucune custody, aucun débit récurrent.
- Mention obligatoire : **« Outil d'analyse, pas un conseil en investissement. »**
- Audit de sécurité et décision mainnet séparés de la livraison Phase 1-3.

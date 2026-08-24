# Seeker I

Dashboard Solana d'analyse et de pilotage, en self-custody, avec interface EN/FR.

## Vue d'ensemble

- **Web :** Vite + React + TypeScript.
- **On-chain :** Anchor/Rust, programme unique `access_gate`.
- **Application :** code dans `src/`, avec pages, composants et librairie Solana.
- **Contrats :** emplacement Anchor CLI sous `programs/`.
- **Services :** Helius, Supabase Edge Functions et Sentry selon les besoins.
- **Accès :** Pass à durée fixe, transaction signée par le wallet de l'utilisateur.

Le produit ne conserve pas les fonds, ne demande pas de clé privée et ne promet aucun rendement. Les clés IA restent côté serveur.

## Documentation

- `.noah/CONTEXT-MINI.md` — contexte de travail Noah.
- `.noah/CHECKLIST-PHASE-1.md` — fondations et contrôles.
- `.noah/IDL-INTERFACE.md` — interface TypeScript générique.
- `docs/ROADMAP.md` — Phases 1 à 3.
- `docs/GLOSSAIRE-DeFi.md` — vocabulaire EN/FR.

> **Outil d'analyse, pas un conseil en investissement.**

# Noah — Checklist Phase 1 : Fondations

## Gouvernance et périmètre

- [ ] Confirmer que le travail est limité à la Phase 1.
- [ ] Confirmer les lignes rouges : self-custody, pas de custody, pas de promesse de rendement, pas d'abonnement auto-débité.
- [ ] Confirmer que le programme on-chain unique est `access_gate`.
- [ ] Ouvrir un ticket ou checkpoint avant chaque lot de changements.
- [ ] Identifier l'impact sécurité, conformité et données personnelles de chaque lot.

## Web Vite

- [ ] Vérifier que le build Vite démarre et que TypeScript strict compile.
- [ ] Mettre en place les routes publiques et la page d'accueil.
- [ ] Mettre en place les états wallet : déconnecté, connecté, réseau incorrect, erreur.
- [ ] Ajouter le socle EN/FR et un sélecteur de langue accessible.
- [ ] Ajouter le disclaimer permanent : « Outil d'analyse, pas un conseil en investissement. »
- [ ] Définir tokens visuels, responsive layout, états loading/empty/error.
- [ ] Vérifier navigation clavier, contrastes, focus et textes traduits.

## Solana et Anchor

- [ ] Initialiser le programme Anchor et ses tests.
- [ ] Définir les comptes `Config`, `PaymentMint` et `Pass`.
- [ ] Définir les seeds PDA et stocker/vérifier les bumps canoniques.
- [ ] Implémenter les contrôles de signer et de propriétaire.
- [ ] Implémenter la configuration one-shot et les mises à jour autorisées.
- [ ] Implémenter la pause avec séparation autorité/guardian.
- [ ] Implémenter l'achat atomique et la validation du paiement.
- [ ] Calculer toute expiration depuis l'horloge on-chain.
- [ ] Refuser les comptes, mints, feeds, décimales, durées et prix incohérents.
- [ ] Couvrir les cas limites : achat sans paiement, replay, expiration, pause, staleness, confiance oracle, stacking borné.
- [ ] Exécuter les tests Anchor et conserver les logs utiles.
- [ ] Générer, sauvegarder et versionner l'IDL après tests verts.

## Intégration et sécurité

- [ ] Connecter l'IDL au client TypeScript sans recopier une interface contradictoire.
- [ ] Construire un SDK minimal : provider, program, PDA helpers, lecture `Pass`.
- [ ] Brancher un seul bouton à une instruction réelle à la fois.
- [ ] Vérifier confirmation, signature, Explorer et gestion d'échec.
- [ ] Ne jamais exposer seed phrase, clé privée ou clé IA.
- [ ] Vérifier absence de secrets dans le dépôt, logs, erreurs et bundles.
- [ ] Tester uniquement sur Devnet avec des adresses explicitement configurées.
- [ ] Faire relire le threat model et les invariants avant déploiement.

## Sortie de Phase 1

- [ ] Build Web reproductible.
- [ ] Tests Anchor verts.
- [ ] IDL et artefacts de déploiement archivés.
- [ ] Parcours wallet → lecture Pass → achat Devnet documenté.
- [ ] Rapport des risques ouverts, décisions et prochaines étapes.

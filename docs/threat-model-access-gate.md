# SEEKER I — Threat Model : `access_gate`

> Statut : **BROUILLON — en attente de validation fondateur**
> Version 0.1 — Phase 1, moteur CITADEL.

### Journal de décision

| Date | Décision |
|---|---|
| Phase 1 | Sections 1 à 11 relues par le fondateur. Feu vert donné pour l'implémentation du Program. |
| Phase 1 | Section 10 — les 5 points ouverts sont implémentés avec les **valeurs par défaut recommandées** ci-dessous, modifiables sans redéploiement (sauf E5) : |

1. **E5 — upgrade de tier** : un achat T2 alors qu'un T1 est actif **remplace** le tier et applique la règle E2 sur la durée. Pas de prorata.
2. **Plafond d'accumulation** : 180 jours.
3. **Seuils oracle** : staleness max 60 s, confidence max 200 bps.
4. **Remboursement** : aucun remboursement on-chain en V1. À refléter dans les CGU.
5. **Multi-sig Squads dès le devnet**, autorité admin distincte de l'upgrade authority.

Ces valeurs sont stockées en compte `Config` / `PaymentMethod`, donc ajustables
par le multi-sig sans redéploiement. Seul le point 1 est une règle de code.

---

## 0. Rappel des lignes rouges

Ce Program est le seul composant on-chain de Seeker I. Il doit respecter,
par construction et pas seulement par convention :

| # | Ligne rouge | Traduction technique dans `access_gate` |
|---|---|---|
| 1 | Aucun token créé | Le Program ne contient **aucune** instruction de `mint`, `burn`, `initialize_mint`, ni création de metadata. Il ne détient aucune mint authority. |
| 2 | Aucune custody | Le Program ne détient **aucun** compte de tokens appartenant à un utilisateur. Aucune PDA n'est propriétaire ni délégué d'un ATA utilisateur. Aucun `approve`. Le paiement est un transfert atomique wallet → trésorerie, dans la même transaction que l'écriture du Pass. |
| 3 | Pas d'abonnement auto-débité | Aucune délégation persistante, aucun `Approve` SPL, aucune instruction déclenchable par l'autorité sur les fonds d'un utilisateur. Chaque renouvellement exige une signature fraîche du wallet. |
| 4 | Permissions Android minimales | Hors scope Program (scope client). Rappelé ici car le Program ne doit jamais exiger de capacité device supplémentaire. |
| 5 | Clés IA côté serveur | Hors scope Program. Le Program ne stocke, ne référence et ne vérifie **aucun** secret IA. |

**Conséquence structurante :** `access_gate` est un Program *stateless du point de
vue des fonds*. Il écrit une date, il ne garde jamais d'argent utilisateur.

---

## 1. Périmètre

### 1.1 Dans le périmètre

- Le Program Anchor `access_gate` (devnet puis mainnet)
- Ses comptes PDA : `Config`, `PaymentMint`, `Pass`
- La consommation du price feed Pyth
- La whitelist de mints de paiement on-chain
- Le flux de paiement de Pass (T1 / T2)
- La vérification de Pass (lecture on-chain par le client et par le backend)

### 1.2 Hors périmètre (traité dans des threat models séparés)

- SKYLINE / SIBYL / VELOCITY / SAGE
- Supabase (base, Edge Functions, stockage des clés IA BYOK)
- L'intégration Jupiter
- Le client PWA et l'APK
- La gouvernance Squads elle-même (multi-sig) — traitée en Phase 5

### 1.3 Ce que ce document **ne** garantit **pas**

Un threat model n'est pas un audit. Il liste des menaces identifiées et les
contre-mesures prévues. Il devra être relu après écriture du code, puis
confronté à un audit externe avant mainnet (Phase 5).

---

## 2. Actifs à protéger

Classés par gravité si compromis.

| Actif | Nature | Impact si compromis |
|---|---|---|
| **A1 — Intégrité du Pass** | Date d'expiration on-chain par wallet | Accès gratuit illimité aux features payantes. Perte de revenus totale. C'est **l'actif principal**. |
| **A2 — Fonds de la trésorerie** | Paiements reçus (SOL/USDC/USDT/SKR) | Vol des revenus encaissés. |
| **A3 — Intégrité de la Config** | Prix, durées, whitelist, seuils oracle | Détournement des paiements, acceptation de faux tokens, prix mis à zéro. |
| **A4 — Correction du prix payé** | Conversion USD → token via Pyth | Pass acheté à prix cassé (perte revenus) ou utilisateur surfacturé (risque réputationnel + conformité). |
| **A5 — Disponibilité** | Capacité à acheter/vérifier un Pass | Utilisateurs bloqués, remboursements, réputation. |
| **A6 — Vie privée utilisateur** | Lien wallet ↔ tier acheté | Faible : intrinsèquement public sur Solana. À documenter, pas à « corriger ». |

**Ce qui n'est pas un actif ici :** les fonds des utilisateurs. Par design, ils
ne transitent jamais par le Program au-delà du transfert de paiement qu'ils ont
eux-mêmes signé.

---

## 3. Acteurs et niveaux de confiance

| Acteur | Confiance | Capacités |
|---|---|---|
| **Utilisateur anonyme** | Aucune | Construit des transactions arbitraires, appelle n'importe quelle instruction avec n'importe quels comptes, en CPI depuis son propre Program. |
| **Utilisateur avec Pass** | Aucune | Idem + possède une PDA `Pass` valide. |
| **Autorité (Squads multi-sig)** | Élevée mais **pas illimitée** | Met à jour Config, whitelist, prix. Doit être M-of-N. Ne doit **pas** pouvoir toucher un Pass déjà payé ni les fonds d'un utilisateur. |
| **Guardian (clé chaude de pause)** | Moyenne | Peut **uniquement** mettre en pause les achats. Ne peut rien dépauser ni modifier. |
| **Backend Seeker I (Supabase)** | Aucune, côté Program | Lit l'état on-chain. N'a **aucune** clé signataire du Program. |
| **Opérateur RPC (Helius)** | Faible | Peut mentir en lecture, censurer, retarder. Ne peut pas forger de signature. |
| **Publisher Pyth** | Moyenne | Source de prix externe. Peut être stale, large, ou manipulé à la marge. |
| **Fondateur / dev** | Élevée | Risque clé unique — voir M-16. |

### 3.1 Frontières de confiance

```
[ Wallet / Seed Vault ]  ──signature──▶  ┌──────────────────────┐
                                          │                      │
[ Client PWA / APK ]     ──tx non signée─▶│   FRONTIÈRE 1        │
                                          │   Runtime Solana     │
[ Backend Supabase ]     ──lecture seule─▶│   + access_gate      │
                                          │                      │
[ Pyth price update ]    ──compte tx────▶ └──────────────────────┘
                                                   ▲
[ Squads multi-sig ]     ──signature admin─────────┘
```

- **Frontière 1 (critique) :** tout ce qui vient du client est hostile. Y compris
  les comptes passés, leur ordre, leur propriétaire, et **tout timestamp**.
- **Frontière 2 :** Pyth est une donnée externe semi-fiable — jamais consommée
  sans validation de fraîcheur, de confiance et d'identité de feed.

---

## 4. Surface d'attaque : instructions proposées

Design minimal. Chaque instruction ajoutée = surface d'attaque ajoutée.

| # | Instruction | Signataire requis | Mutation |
|---|---|---|---|
| I1 | `initialize_config` | Autorité (Squads) | Crée `Config`. One-shot. |
| I2 | `update_config` | Autorité (Squads) | Prix, durées, seuils oracle, discount SKR. |
| I3 | `set_treasury` | Autorité (Squads) | Change la destination des paiements. **Instruction la plus dangereuse.** |
| I4 | `upsert_payment_mint` | Autorité (Squads) | Ajoute/modifie une entrée whitelist. |
| I5 | `set_payment_mint_enabled` | Autorité (Squads) | Active/désactive un mint (kill-switch granulaire). |
| I6 | `set_paused` | Autorité **ou** Guardian | Pause. Dépause = autorité uniquement. |
| I7 | `purchase_pass` | **Utilisateur** | Paie et crée/étend `Pass`. Seule instruction publique. |

### 4.1 Instructions volontairement **absentes** (et pourquoi)

| Instruction écartée | Raison |
|---|---|
| `admin_grant_pass` | Permettrait à l'autorité d'octroyer des Pass gratuits → vecteur d'abus interne + comptabilité opaque. Les comps se gèrent hors-chaîne (code promo backend) si besoin. **À trancher — voir Q3.** |
| `refund_pass` | Impliquerait que le Program détienne des fonds. Viole la ligne rouge n°2. Remboursements manuels depuis la trésorerie Squads. |
| `revoke_pass` | L'autorité ne doit pas pouvoir annuler un Pass payé. Protège A1 contre une autorité compromise. |
| `withdraw_treasury` | La trésorerie est un compte Squads, pas une PDA du Program. Le Program n'a donc jamais à retirer quoi que ce soit. |
| `close_config` | Rien à gagner, tout à perdre. |

---

## 5. Modèle de comptes

### 5.1 `Config` — PDA `["config"]`

| Champ | Type | Note sécurité |
|---|---|---|
| `authority` | `Pubkey` | Squads multi-sig. Jamais une clé unique en mainnet. |
| `pending_authority` | `Option<Pubkey>` | Transfert d'autorité en **deux étapes** (voir M-15). |
| `guardian` | `Pubkey` | Clé chaude, pause uniquement. |
| `treasury` | `Pubkey` | Propriétaire des ATA de réception. |
| `paused` | `bool` | Bloque `purchase_pass` uniquement. |
| `price_t1_usd_micro` | `u64` | 4 990 000 = 4,99 $. Entiers uniquement, jamais de flottant. |
| `price_t2_usd_micro` | `u64` | 14 990 000 |
| `duration_t1_secs` | `i64` | 604 800 |
| `duration_t2_secs` | `i64` | 2 592 000 |
| `skr_discount_bps` | `u16` | 1500 = 15 %. Borné ≤ 5000. |
| `max_price_age_secs` | `u64` | Seuil de staleness Pyth. Défaut **60 s**. Borné [10, 300]. |
| `max_conf_bps` | `u16` | Intervalle de confiance max. Défaut **100 bps (1 %)**. Borné ≤ 500. |
| `max_pass_horizon_secs` | `i64` | Plafond d'empilement (voir M-08). Défaut 365 j. |
| `version` | `u8` | Versioning de schéma pour migrations. |
| `bump` | `u8` | Bump canonique stocké. |

### 5.2 `PaymentMint` — PDA `["mint", mint]`

**Un compte par mint**, pas un `Vec` dans `Config`. Raisons : pas de realloc, pas
de borne de taille à gérer, pas de DoS par whitelist géante, ajout atomique.

| Champ | Type | Note sécurité |
|---|---|---|
| `mint` | `Pubkey` | Redondant avec le seed — sert de contrôle croisé. |
| `decimals` | `u8` | Copié depuis le mint **à l'ajout**, revérifié à chaque paiement. |
| `token_program` | `Pubkey` | Token classique **ou** Token-2022, figé explicitement (voir M-10). |
| `pyth_feed_id` | `[u8; 32]` | Feed ID attendu. **Le cœur de la défense oracle.** |
| `enabled` | `bool` | Kill-switch. |
| `discount_eligible` | `bool` | `true` uniquement pour SKR. |
| `is_native_sol` | `bool` | SOL natif = transfert lamports, pas SPL (voir Q1). |
| `bump` | `u8` | |

### 5.3 `Pass` — PDA `["pass", owner]`

| Champ | Type | Note sécurité |
|---|---|---|
| `owner` | `Pubkey` | Le wallet. Contrôle croisé avec le seed. |
| `tier` | `u8` | 1 ou 2. |
| `expires_at` | `i64` | **Toujours** dérivé de `Clock::get()?.unix_timestamp`. |
| `last_purchase_at` | `i64` | Idem. Anti-rejeu / audit. |
| `total_purchases` | `u32` | Télémétrie on-chain, sans PII. |
| `bump` | `u8` | |

**Note vie privée (A6) :** la PDA est dérivée du wallet, donc le tier de chaque
utilisateur est publiquement lisible. C'est assumé et inhérent à Solana. À
mentionner dans la politique de confidentialité, pas à masquer par obscurité.

---

## 6. Menaces identifiées

Notation : **P** probabilité, **I** impact, **S** sévérité = P × I.
Échelle : Faible / Moyen / Élevé / Critique.

---

### T-01 — Forge de Pass par PDA arbitraire
**Actif : A1 · S : Critique**

L'attaquant passe un compte `Pass` qu'il contrôle (créé par son propre Program,
ou une PDA d'un autre seed) et se fait attribuer une expiration lointaine sans
payer.

**Mitigations**
- `seeds = [b"pass", owner.key()]` + `bump` vérifié par Anchor à chaque appel.
- Contrainte `pass.owner == owner.key()` en plus du seed (défense en profondeur
  contre une erreur de refactor sur les seeds).
- `owner` doit être **`Signer`**, jamais un simple `AccountInfo`.
- Discriminator Anchor vérifié (natif via `Account<'info, Pass>`).
- Init via `init_if_needed` avec `payer = owner` — jamais un payer arbitraire.

---

### T-02 — Timestamp d'expiration fourni par le client
**Actif : A1 · S : Critique** — *point explicitement soulevé par le fondateur*

Le client envoie `expires_at` ou un `now` en argument d'instruction, et
l'attaquant met la date en 2099.

**Mitigations**
- **Aucun timestamp n'est accepté en argument d'instruction. Jamais.**
- `expires_at` est **exclusivement** calculé on-chain :
  `base = max(pass.expires_at, Clock::get()?.unix_timestamp)`
  puis `expires_at = base.checked_add(duration_from_config)?`
- `duration_*` vient de `Config`, jamais du client. Le client ne choisit que le
  **tier** (`u8`, validé ∈ {1,2}).
- Le `Clock` sysvar est lu via `Clock::get()`, pas via un compte sysvar passé par
  le client (évite tout risque de compte sysvar usurpé).
- Toute arithmétique de date en `checked_add` — un overflow `i64` sur
  `expires_at` produirait une date négative = Pass gratuit permanent.

---

### T-03 — Faux mint usurpant un symbole
**Actif : A4 · S : Élevé** — *point explicitement soulevé par le fondateur*

L'attaquant crée un mint nommé « USDC » avec 6 décimales, en frappe 15, et achète
un Pass T2 pour zéro dollar réel.

**Mitigations**
- Le mint de paiement doit avoir une PDA `PaymentMint` dérivée de
  `["mint", mint.key()]` **existante et `enabled`**. Un faux mint n'a pas de PDA
  → l'instruction échoue au niveau de la résolution de compte.
- La whitelist est **on-chain et modifiable par Squads uniquement** — jamais
  hardcodée dans le binaire (permettrait d'ajouter un mint sans redéploiement, et
  surtout de désactiver un mint compromis en urgence).
- Le compte `mint` passé est typé `InterfaceAccount<'info, Mint>` → propriétaire
  forcément un programme de token légitime.
- `mint.decimals == payment_mint.decimals` revérifié à chaque paiement.
- `payment_mint.mint == mint.key()` (contrôle croisé seed ↔ contenu).

**Note :** les symboles/metadata ne sont **jamais** lus on-chain. La seule identité
qui compte est la Pubkey du mint.

---

### T-04 — Prix Pyth périmé (staleness)
**Actif : A4 · S : Élevé** — *point explicitement soulevé par le fondateur*

Pyth est un oracle **pull** : c'est le client qui poste la mise à jour de prix
dans la transaction. Un attaquant peut donc délibérément poster une mise à jour
ancienne, choisie au moment où SOL/SKR valait le plus cher — et payer moins de
tokens pour le même Pass.

**Mitigations**
- Vérification obligatoire :
  `clock.unix_timestamp - price.publish_time <= config.max_price_age_secs`
  (défaut 60 s, borné [10, 300]).
- Vérification symétrique du futur :
  `price.publish_time <= clock.unix_timestamp + 5` — un `publish_time` dans le
  futur est anormal et doit être rejeté.
- Le seuil est en `Config`, ajustable par Squads sans redéploiement (les
  conditions réseau varient).
- Erreur dédiée `StalePriceFeed` pour distinguer clairement en télémétrie.

---

### T-05 — Intervalle de confiance Pyth trop large
**Actif : A4 · S : Élevé** — *point explicitement soulevé par le fondateur*

Pendant un épisode de volatilité ou de désaccord entre publishers, Pyth renvoie
un prix avec une confiance `conf` très large. Le prix médian devient peu fiable.

**Mitigations**
- Rejet si `conf * 10_000 / price > config.max_conf_bps` (défaut 100 bps).
- Rejet si `price <= 0` (Pyth peut renvoyer des valeurs non positives en cas
  d'anomalie ; un prix ≤ 0 doit faire échouer, jamais être clampé).
- Approche **conservatrice** dans le calcul du montant dû : on utilise
  `price - conf` comme prix effectif du token de paiement. Concrètement, si le
  marché est incertain, l'utilisateur paie légèrement plus de tokens plutôt que
  moins. La perte de revenus est un risque asymétrique par rapport à une
  surfacturation marginale — mais **ce choix doit être validé** (voir Q4), car il
  a un effet sur la perception utilisateur.
- Erreur dédiée `PriceConfidenceTooWide`.

---

### T-06 — Substitution de compte de price feed
**Actif : A4 · S : Critique**

L'attaquant passe le feed BTC/USD au lieu de SOL/USD, ou un compte qu'il a lui-même
créé imitant la structure Pyth.

**Mitigations**
- Le compte de mise à jour de prix est typé via le SDK receiver Pyth →
  propriétaire vérifié = programme Pyth receiver, structure désérialisée par le SDK.
- **Le `feed_id` du prix lu doit être strictement égal à
  `payment_mint.pyth_feed_id`.** C'est le contrôle décisif : sans lui, la
  vérification de propriétaire ne suffit pas.
- Le `feed_id` est figé par mint à l'ajout en whitelist, modifiable seulement via
  Squads.
- Vérification de l'`exponent` retourné : borné à une plage attendue
  (ex. `[-12, 0]`) avant toute mise à l'échelle.

---

### T-07 — Détournement de la trésorerie
**Actif : A2 · S : Critique**

L'attaquant passe son propre compte de tokens comme destination du paiement, ou
appelle `set_treasury`.

**Mitigations**
- Le compte de destination doit être l'**ATA canonique** dérivée de
  `(config.treasury, mint, token_program)`. Vérification par contrainte
  `associated_token::authority = config.treasury` — pas une simple égalité de
  Pubkey fournie.
- Pour SOL natif : destination = `config.treasury` exactement.
- `set_treasury` réservé à l'autorité Squads, et **journalisé par un event**
  on-chain avec ancienne et nouvelle valeur (détection).
- **À évaluer (Q5) :** timelock sur `set_treasury`. Une autorité Squads
  compromise pourrait rediriger les paiements instantanément. Un délai de 24-48 h
  avec event permettrait de réagir.

---

### T-08 — Manipulation du montant payé (slippage / sandwich)
**Actif : A4 · S : Moyen**

Un attaquant qui influence le prix spot au moment exact du paiement peut réduire
le montant dû. Inversement, un utilisateur honnête peut se retrouver à payer plus
que ce que l'UI lui affichait.

**Mitigations**
- Argument `max_amount_in: u64` fourni par l'utilisateur. Si le montant calculé
  on-chain dépasse `max_amount_in`, la transaction échoue
  (`SlippageExceeded`). C'est la tolérance ±2 % évoquée dans les specs, appliquée
  **on-chain**, pas seulement dans l'UI.
- Symétriquement, un plancher `min_amount_in` protège le protocole contre un prix
  anormalement favorable à l'utilisateur. **À trancher (Q4)** — redondant avec la
  staleness + confidence checks, potentiellement source de faux échecs.
- Arrondi : le montant dû est **toujours arrondi vers le haut** (`ceil`). Un
  arrondi vers le bas répété est une fuite de valeur classique.
- Toute la conversion USD → token en arithmétique entière `u128` intermédiaire,
  `checked_*` partout, jamais de `as` silencieux.

---

### T-09 — Empilement abusif de Pass
**Actif : A1 · S : Faible**

Un utilisateur enchaîne 500 achats T2 pour obtenir un Pass de 40 ans, ou provoque
un overflow de `expires_at`.

**Mitigations**
- Plafond `config.max_pass_horizon_secs` (défaut 365 j) :
  `expires_at <= now + max_pass_horizon` sinon rejet.
- `checked_add` sur toute l'arithmétique de date.
- Note : l'empilement en soi n'est pas une attaque (il a payé), mais le plafond
  évite un état absurde et borne l'exposition en cas de bug de pricing.

---

### T-10 — Extensions Token-2022 hostiles
**Actif : A2, A4 · S : Élevé**

Un mint Token-2022 whitelisté par erreur peut porter une extension `TransferFee`
(la trésorerie reçoit moins que le montant transféré), `PermanentDelegate` (le
créateur du mint peut reprendre les fonds de la trésorerie), `TransferHook` (CPI
arbitraire), ou `ConfidentialTransfer`.

**Mitigations**
- Utilisation systématique de **`transfer_checked`** (jamais `transfer`) — impose
  mint + decimals et échoue sur incohérence.
- `payment_mint.token_program` figé à l'ajout ; le programme de token passé en
  compte doit être exactement celui-là.
- **Vérification du montant réellement reçu** : lecture du solde de l'ATA
  trésorerie avant/après, et rejet si le delta < montant attendu. Neutralise
  `TransferFee` de façon générique, sans avoir à énumérer les extensions.
- **Checklist d'ajout en whitelist** (procédure humaine, à formaliser avant tout
  ajout via Squads) : refuser tout mint portant `PermanentDelegate`,
  `TransferHook`, `ConfidentialTransfer`, ou une `freeze_authority` non nulle sur
  un stablecoin non officiel.
- USDC et USDT mainnet ont une `freeze_authority` (par design de l'émetteur) —
  c'est accepté et documenté, pas un blocage.

---

### T-11 — Confusion de type de compte / réinitialisation
**Actif : A1, A3 · S : Élevé**

Passer un `Pass` là où un `Config` est attendu, ou réinitialiser un `Config`
existant pour en reprendre le contrôle.

**Mitigations**
- Comptes typés Anchor (`Account<'info, T>`) → discriminator 8 octets vérifié.
- `initialize_config` en `init` strict (pas `init_if_needed`) → échoue si le
  compte existe déjà.
- `init_if_needed` **uniquement** sur `Pass`, avec réinitialisation impossible :
  les champs ne sont jamais écrasés à zéro, `expires_at` est toujours calculé par
  `max(existant, now) + durée`.
- Bumps canoniques stockés et utilisés, jamais recalculés à partir d'un bump
  fourni par le client.

---

### T-12 — Réentrance / CPI hostile
**Actif : A1, A2 · S : Moyen**

`purchase_pass` appelée en CPI depuis un Program attaquant, ou un transfer hook
qui rappelle `access_gate`.

**Mitigations**
- Toutes les mutations d'état (`Pass`) sont effectuées **avant** le CPI de
  transfert ? **Non — l'inverse.** Ordre retenu : validation → transfert →
  vérification du delta reçu → écriture du `Pass`. Le Pass n'est écrit que si les
  fonds sont confirmés arrivés. Comme le Program ne relit pas d'état après CPI
  pour prendre une décision de fonds, il n'y a pas de fenêtre de réentrance
  exploitable.
- `owner` doit être `Signer` — un Program appelant ne peut pas usurper une
  signature de wallet.
- **À évaluer (Q6) :** interdire explicitement l'appel en CPI via inspection des
  instructions sysvar. Probablement excessif, mais à discuter.

---

### T-13 — Rejeu / double dépense de la transaction
**Actif : A1 · S : Faible**

Rejouer une transaction d'achat signée pour obtenir plusieurs Pass avec un seul
paiement.

**Mitigations**
- Protection native Solana : une signature de transaction ne peut être exécutée
  qu'une fois (dedup par blockhash récent).
- **Point d'attention mobile :** l'usage prévu de **nonces durables** (déjà
  implémenté dans ce projet pour Seeker) change la donne — une transaction à
  nonce durable reste valide tant que le nonce n'a pas avancé. Le `nonceAdvance`
  en première instruction garantit l'unicité, mais cela doit être vérifié
  explicitement côté client, et une tx à nonce durable non diffusée reste
  signée et valide indéfiniment. **À documenter dans le threat model client.**
- `last_purchase_at` écrit à chaque achat = trace d'audit.

---

### T-14 — Déni de service sur `purchase_pass`
**Actif : A5 · S : Moyen**

- Front-running de la création de la PDA `Pass` par un tiers qui paie le rent.
- Congestion réseau / RPC Helius indisponible.
- Pyth non mis à jour sur devnet pour un feed donné.

**Mitigations**
- `payer = owner` sur `init_if_needed` → un tiers ne peut pas créer la PDA `Pass`
  d'autrui (il ne peut pas signer pour `owner`).
- Pas de compte partagé mutable entre utilisateurs → **aucune contention d'écriture
  globale**. `Config` et `PaymentMint` sont lus en read-only pendant
  `purchase_pass`. C'est structurant : ne jamais ajouter de compteur global
  mutable dans `Config` (ex. `total_sales`), cela sérialiserait tous les achats.
- Fallback RPC côté client (déjà en place dans ce projet).
- `set_payment_mint_enabled` permet de désactiver un mint dont le feed Pyth est
  défaillant sans bloquer les autres moyens de paiement.

---

### T-15 — Autorité compromise
**Actif : A2, A3 · S : Critique**

La clé d'autorité est volée ou le fondateur perd l'accès.

**Mitigations**
- **Mainnet : Squads multi-sig M-of-N obligatoire.** Jamais de clé unique.
  Devnet peut rester en clé unique, mais le code ne doit faire aucune hypothèse
  différente entre les deux.
- Transfert d'autorité en **deux étapes** (`propose` puis `accept`) — évite le
  transfert vers une adresse erronée ou non contrôlée, irréversible.
- Séparation `guardian` / `authority` : la clé chaude peut **pauser** mais pas
  dépauser ni modifier. Limite l'impact d'une fuite de la clé de pause.
- L'autorité ne peut **pas** révoquer un Pass ni toucher les fonds utilisateur
  (par absence d'instruction — cf. §4.1). Une autorité compromise peut détourner
  les revenus **futurs**, pas les Pass déjà vendus.
- Events on-chain sur toute mutation admin + alerte Sentry sur détection.

---

### T-16 — Risque de clé unique côté fondateur
**Actif : A2, A3 · S : Élevé**

Projet solo. Perte de la clé de déploiement = perte de contrôle du Program.

**Mitigations**
- Upgrade authority du Program transférée à Squads avant mainnet (Phase 5).
- Procédure de sauvegarde documentée hors-ligne.
- **À évaluer (Q7) :** rendre le Program immuable après audit. Élimine T-16 et
  T-15 sur l'upgrade, mais interdit tout correctif. Décision de Phase 5, pas
  maintenant.

---

### T-17 — Divergence lecture on-chain / affichage client
**Actif : A1 · S : Moyen**

Le backend ou le client lit un état obsolète (`commitment: processed`, ou RPC qui
ment) et accorde l'accès à un Pass expiré — ou le refuse à tort.

**Mitigations**
- Le gating de features **payantes et sensibles** (sniper mode, SAGE) est vérifié
  côté backend, jamais uniquement côté client. Le gating côté client est un confort
  UX, pas une barrière de sécurité.
- Lectures en `commitment: 'confirmed'` minimum ; `'finalized'` pour l'activation
  d'un Pass fraîchement payé.
- Le backend relit l'état on-chain directement, ne fait pas confiance à un
  paramètre envoyé par le client.
- **Rappel de posture :** un utilisateur qui contourne le gating client accède à
  une UI, pas à une capacité serveur. Les appels IA (coûteux) doivent être gated
  côté serveur, sinon T-17 devient une fuite de coûts réelle.

---

### T-18 — Erreur d'échelle décimale
**Actif : A4 · S : Élevé**

SOL a 9 décimales, USDC/USDT 6, SKR à confirmer. L'exposant Pyth est négatif et
variable. Une seule erreur de mise à l'échelle = Pass à 0,001 $ ou à 5 000 $.

**Mitigations**
- Formule unique, centralisée dans une fonction pure testée isolément, jamais
  dupliquée entre instructions.
- Arithmétique `u128` en intermédiaire, `checked_*` systématique, arrondi `ceil`.
- Bornes de sanité on-chain : le montant calculé doit être > 0 et < un plafond
  absolu par mint. Un montant nul doit **toujours** échouer.
- Tests unitaires obligatoires sur chaque combinaison (mint × exposant × tier),
  incluant les cas limites d'exposant.

---

### T-19 — Exposition d'un secret IA via le Program
**Actif : hors périmètre · S : N/A**

**Statut : éliminé par design.** `access_gate` ne stocke, ne référence et ne
vérifie aucun secret. Toute proposition future d'y mettre un hash de clé, un
identifiant de session IA ou une empreinte quelconque doit être refusée : Solana
est public, et cela violerait la ligne rouge n°5.

---

## 7. Tableau récapitulatif des signer checks

Le contrôle le plus important du Program. À revérifier ligne par ligne au code review.

| Instruction | `Signer` requis | Contrainte d'autorité | Timestamp accepté du client |
|---|---|---|---|
| `initialize_config` | `authority` | — (one-shot, `init` strict) | **Non** |
| `update_config` | `authority` | `== config.authority` | **Non** |
| `set_treasury` | `authority` | `== config.authority` | **Non** |
| `upsert_payment_mint` | `authority` | `== config.authority` | **Non** |
| `set_payment_mint_enabled` | `authority` | `== config.authority` | **Non** |
| `set_paused` (pause) | `authority` **ou** `guardian` | `== config.authority \|\| == config.guardian` | **Non** |
| `set_paused` (unpause) | `authority` | `== config.authority` **strict** | **Non** |
| `purchase_pass` | `owner` | `owner == pass.owner` **et** seed `["pass", owner]` | **Non — `Clock::get()` uniquement** |

**Règle absolue, sans exception :** aucune instruction de `access_gate` n'accepte
de timestamp, de date d'expiration, de durée ou de prix USD provenant du client.
Le client ne fournit que : `tier` (u8), `max_amount_in` (u64), et les comptes.

---

## 8. Invariants à tester

Ces assertions doivent être vérifiées par des tests automatisés avant tout
déploiement, devnet comme mainnet.

**Intégrité du Pass**
1. Un `Pass` ne peut jamais être créé ou étendu sans transfert de fonds confirmé.
2. `expires_at` est toujours strictement croissant après un achat réussi.
3. `expires_at <= now + max_pass_horizon_secs` en toutes circonstances.
4. Aucune instruction ne peut réduire `expires_at` d'un Pass existant.
5. Un wallet ne peut pas créer la PDA `Pass` d'un autre wallet.

**Fonds**
6. Le Program ne détient aucun ATA à la fin de toute transaction.
7. Le delta du solde de l'ATA trésorerie ≥ montant attendu, toujours.
8. Le Program n'émet jamais de CPI `approve` ni `set_authority`.

**Oracle**
9. Un prix de plus de `max_price_age_secs` fait échouer l'achat.
10. Un `conf/price` supérieur à `max_conf_bps` fait échouer l'achat.
11. Un feed dont le `feed_id` diffère de `payment_mint.pyth_feed_id` fait échouer.
12. Un prix ≤ 0 fait échouer.

**Whitelist**
13. Un mint sans PDA `PaymentMint` fait échouer.
14. Un mint `enabled == false` fait échouer.
15. Le discount SKR ne s'applique que si `discount_eligible == true`.

**Admin**
16. Aucune instruction admin n'est exécutable sans la signature de `config.authority`
    (sauf pause par guardian).
17. Le guardian ne peut pas dépauser.
18. Un transfert d'autorité incomplet (proposé, non accepté) laisse l'autorité
    d'origine intacte.

**Arithmétique**
19. Aucun overflow/underflow possible sur `expires_at`, sur le montant dû, ni sur
    la mise à l'échelle décimale (tests avec valeurs extrêmes).
20. Le montant dû est toujours arrondi vers le haut, jamais nul.

---

## 9. Conformité — vérification croisée

| Exigence | Statut dans ce design |
|---|---|
| Pas de token créé | ✅ Aucune instruction de mint. Program sans mint authority. |
| Pas de custody | ✅ Le Program ne détient aucun compte de tokens. Transfert direct wallet → trésorerie. |
| Pas d'abonnement auto-débité | ✅ Aucune délégation, aucun `approve`. Chaque achat = signature fraîche. |
| Pas de promesse de gain | ⚠️ Hors Program, mais **le wording de SIBYL reste à cadrer** (cf. session précédente). Le Program lui-même est neutre. |
| Pas de géoblocage | ✅ Aucune logique de juridiction on-chain. |
| Fonds utilisateurs intouchables | ✅ Par absence structurelle d'instruction le permettant. |

**Point de vigilance non technique :** encaisser des paiements en crypto contre un
service génère une obligation comptable et fiscale en France, indépendamment de
l'absence de custody. Hors scope de ce document, mais à ne pas découvrir en
Phase 5.

---

## 10. Questions ouvertes — à trancher avant le code

| # | Question | Recommandation |
|---|---|---|
| **Q1** | SOL natif accepté en lamports directs, ou wSOL uniquement ? Les lamports directs ajoutent un chemin de code séparé (donc une surface d'attaque distincte) ; wSOL uniformise tout mais dégrade l'UX mobile. | **wSOL** pour la v1 — un seul chemin de code = moins de bugs. À reconsidérer si l'UX Seeker en souffre. |
| **Q2** | Le paiement en SKR utilise-t-il un feed Pyth SKR/USD ? S'il n'existe pas ou est peu liquide, T-04/T-05 deviennent critiques sur ce mint. | Vérifier l'existence et la qualité du feed **avant** de whitelister SKR. Si absent : SKR retiré de la v1. |
| **Q3** | Garde-t-on une instruction `admin_grant_pass` pour les comps / support / partenariats ? | **Non** en v1. Vecteur d'abus interne pour un besoin marginal. Gérer hors-chaîne. |
| **Q4** | Prix conservateur (`price - conf`) et plancher `min_amount_in` : on applique les deux, l'un, ou aucun ? | `price - conf` **oui**. `min_amount_in` **non** — redondant avec staleness+conf, et source de faux échecs frustrants. |
| **Q5** | Timelock sur `set_treasury` (24-48 h) ? | **Oui en mainnet.** C'est l'instruction qui redirige tous les revenus. Ajoute de la complexité — à confirmer. |
| **Q6** | Interdire l'appel de `purchase_pass` en CPI ? | **Non.** `Signer` suffit. L'inspection du sysvar d'instructions ajoute de la complexité sans gain clair. |
| **Q7** | Program immuable après audit ? | Décision de **Phase 5**, pas maintenant. Mentionné pour ne pas l'oublier. |
| **Q8** | Durée du Pass : le compteur démarre au paiement, même si l'utilisateur ne se connecte pas ? | Oui — comportement standard, à écrire noir sur blanc dans les CGU. |

---

## 11. Ce qui reste à modéliser (documents séparés)

- **Threat model client** — nonce durable et transactions à validité longue (T-13),
  gating côté UI, deep links Mobile Wallet Adapter, `appIdentity` et phishing
  d'autorisation.
- **Threat model backend** — stockage chiffré des clés IA BYOK (rotation, at-rest,
  qui peut déchiffrer, que voit un dump Postgres), RLS Supabase, rate limiting des
  appels IA, webhooks Helius non authentifiés.
- **Threat model VELOCITY** — intégration Jupiter, slippage, simulation de tx,
  approbations de tokens.

---

## 12. Validation

- [ ] Actifs et acteurs conformes à la vision produit
- [ ] Périmètre d'instructions validé (notamment les absences du §4.1)
- [ ] Questions Q1 → Q8 tranchées
- [ ] Seuils par défaut validés (60 s staleness, 100 bps confidence, 365 j horizon)
- [ ] Liste des invariants du §8 acceptée comme critère de test

**Aucun code Rust ne sera écrit avant que ces cases soient cochées.**

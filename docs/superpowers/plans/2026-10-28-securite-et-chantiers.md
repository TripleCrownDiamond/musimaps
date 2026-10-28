# Sécurité et chantiers ouverts — plan du 28 octobre 2026

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** fermer les failles relevées par l'audit du 28 octobre, rendre la production
vérifiable et reconstructible, puis ouvrir les chantiers produit manquants.

**Architecture :** les règles d'accès vivent en base (migrations + triggers + RPC SECURITY
DEFINER) ; les apps passent par `packages/shared`. Toute limite publique est un compteur
quotidien `rate_limits` (par compte, sinon par IP, plus un plafond global).

**Tech stack :** Supabase Postgres, edge functions Deno, React 19 / Vite, Expo 57, Vitest,
`node --test`, Postgres jetable dans Docker (`npm run test:db`).

**Spec :** l'audit du 28 octobre 2026 (failles 1 à 13, fonctionnalités manquantes, dettes).

## Global Constraints

- Jamais de migration appliquée en production par l'agent : `npm run db:migrate` est lancé par l'équipe.
- Tests SQL uniquement sur Postgres jetable (`npm run test:db`), jamais `DB_URL` vers la production.
- Règle 0 de `CLAUDE.md` : logique commune dans `packages/shared`, aucune chaîne visible en dur.
- Les apps installées (anciennes versions mobiles) doivent continuer à fonctionner après chaque migration.
- `npm run check` doit passer avant tout commit.

## Review Focus

- Une ville vide explorée sans compte doit toujours afficher ses artistes (≤ 10) : quota de 40 nouveaux pins / jour / visiteur.
- Un artiste qui renvoie le formulaire avec le même email depuis son compte doit mettre sa demande à jour.
- Un visiteur derrière une IP partagée (opérateur mobile au Bénin) ne doit pas bloquer les autres avant les plafonds globaux.
- La revendication par `link_waitlist_to_account` et la validation `review_claim` doivent toujours écrire `claimed_by` / `verified`.
- Le contenu existant du CMS (gras, liens, classes Tailwind, `style`) doit s'afficher à l'identique après filtrage.

---

## Lot A — fait les 28 et 29 octobre (base et fonctions en production, site à déployer)

### Task A1 : migration `00083_security_hardening.sql` ✅

- [x] Compteurs `rate_limits` + `request_subject()` (compte, sinon `cf-connecting-ip`) + `consume_rate_limit`.
- [x] `map_artists` : insert direct jamais vérifié / revendiqué ; propriétaire ne touche plus `verified`,
  `claimed_by`, `claimed_at`, `followers` ; liens / image sans `javascript:` `data:` ; longueurs bornées ;
  40 nouveaux pins / visiteur / jour, 500 au total (redécouverte gratuite).
- [x] `notify_discovery` : texte du client ignoré, artiste créé il y a < 15 min, un seul envoi.
- [x] `notify_artist_action` : 280 caractères, une alerte par auteur / type / jour.
- [x] `waitlist` : plus d'UPDATE public ; insert direct jamais au nom d'un autre ; RPC `submit_waitlist`
  (compte = session, pas d'écrasement anonyme, 5 / jour / visiteur).
- [x] `artist-images` : 20 envois / visiteur / jour, 500 au total.
- [x] Tests : `scripts/db-test/security-hardening.test.mjs` (11 tests) — `npm run test:db -- security`.
- [x] `00084_rate_limit_private.sql` : sur Supabase, `REVOKE … FROM public` ne retire pas l'EXECUTE
  accordé à anon / authenticated par défaut — `consume_rate_limit` était appelable (constaté en
  production). Le test rejoue désormais ces droits par défaut.

### Task A2 : clients ✅

- [x] `packages/shared/src/lib/waitlistSubmit.ts` : `submitWaitlistEntry()` (RPC, repli upsert tant que 00083 manque) + 4 tests Vitest.
- [x] Web `saveSignup` et mobile `applyAsArtist` l'utilisent (duplication supprimée).
- [x] `RichText` (web) : `rehype-sanitize` après `rehype-raw` (scripts, iframes, `on*`, `javascript:` retirés).
- [x] `.htaccess` : HSTS + CSP minimale (`object-src`, `base-uri`, `frame-ancestors`).
- [x] Quota IA (`_shared/aiQuota.ts`) : IP lue d'abord dans `cf-connecting-ip`.
- [x] `npm run db:schema` : export du schéma de production (structure seule) dans `supabase/schema/production.sql`.
- [x] CI GitHub `.github/workflows/ci.yml` : `npm run check` + `npm run test:db`.
- [x] `design:check` repassé sous son plafond (deux cercles mobiles → `radii.full`).

## Lot B — à lancer par l'équipe (accès production ou compte externe)

### Task B1 : mise en production de la sécurité

- [x] `npm run db:migrate` — 00082, 00083, 00084 appliquées le 29 octobre (00079 l'était déjà).
- [x] `npx supabase functions deploy ai_verify ai_artist_agent --project-ref sminkhihrfcvpggamdsy`.
- [ ] Push sur `main` : Hostinger reconstruit le site (le FTP de `deploy:web` n’est plus configuré).
- [ ] Build mobile (EAS) : le formulaire d'artiste passe par `submit_waitlist`.
- [ ] Commiter `00079_guard_account_type.sql` (appliquée en production, absente du dépôt).
- [ ] Contrôle : un formulaire « Rejoindre la liste » envoyé depuis le site arrive dans l'admin.

### Task B2 : schéma de production versionné

- [ ] `npm run db:schema` → relire `supabase/schema/production.sql`, en particulier : politique d'INSERT
  de `admins` (bootstrap « premier compte »), politique SELECT de `profiles`, définition de `is_admin()`.
- [ ] Si `admins` accepte encore un insert quand la table est vide : migration qui le ferme.
- [ ] Commiter le fichier : la base devient reconstructible depuis le dépôt.

### Task B3 : sauvegardes

- [ ] Créer le dépôt privé `musimaps-sauvegardes`, y copier `scripts/backup/github-workflow.yml`.
- [ ] Quatre secrets (voir `docs/SAUVEGARDES.md`), premier *Run workflow*, puis test de restauration.

### Task B4 : comptes admin

- [ ] Activer la double authentification (MFA TOTP Supabase) sur les comptes de la table `admins`.

## Lot C — chantiers produit (un plan détaillé chacun avant d'écrire le code)

| # | Chantier | Besoin externe | Ordre |
|---|---|---|---|
| C1 | Captcha Cloudflare Turnstile : inscription, liste d'attente, photos (Supabase Auth captcha + widget web, WebView mobile) | compte Cloudflare, clés site / secret | 1 |
| C2 | Sentry (web + mobile) + suivi d'usage (PostHog) : erreurs, rétention, entonnoirs | comptes Sentry / PostHog | 2 |
| C3 | Mises à jour à distance `expo-updates` (correctifs sans revue des stores) | nouveau build EAS | 3 |
| C4 | Notifications push : table `push_tokens`, enregistrement Expo, envoi par edge function | clé FCM V1 (Android), APNs via EAS | 4 |
| C5 | Paiement Mobile Money (FedaPay ou KkiaPay) + webhook `service_role` → `account_type` ; réouvre Business et donc la réservation | compte marchand, clés | 5 |
| C6 | Concerts / événements : table `events`, saisie par l'artiste revendiqué, affichage carte et fiche | — | 6 |
| C7 | Revendication avec preuve (lien officiel, email pro) avant le badge vérifié | — | 7 |
| C8 | Mode hors ligne mobile (cache carte + fiches consultées) | — | 8 |
| C9 | CSP complète (`script-src` listé : Apple, Google, Mapbox workers `blob:`) en Report-Only puis stricte | — | 9 |
| C10 | Dettes : `ExploreScreen.tsx` (3 282 l.) et `GlobeExplore.tsx` (2 070 l.) découpés ; doublons de `docs/` en minuscules supprimés ; `PROJECT-STATE.md` remis à jour | — | continu |

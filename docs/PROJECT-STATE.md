# Musimaps — État complet du projet

> Dernière mise à jour : **10 août 2026** — sauvegarde complète du contexte, de la doc et des évolutions.
> Voir aussi : [`CHANGELOG.md`](./CHANGELOG.md) pour l'historique des évolutions.

---

## 1. Vision produit

**Musimaps** est « la carte vivante de la musique » : une carte du monde (globe Mapbox) sur laquelle chaque
artiste est un pin à l'endroit où il crée réellement. Monde → Continent → Pays → Ville → Quartier → Artistes.

Deux clients (web + mobile) partagent un seul backend Supabase et un package `shared`.

---

## 2. Architecture (monorepo npm workspaces)

```text
musimaps/
├─ apps/
│  ├─ web/                  # React 19 + Vite 8 + Mapbox GL v3 + Tailwind 4 + shadcn/ui
│  │  ├─ src/admin/         # Espace administrateur (CMS + modération + stats + IA)
│  │  ├─ src/pages/         # Landing, Globe, Artistes, Profils, Auth, Dashboard…
│  │  └─ src/components/    # ArtistSheet, GlobeMap, PlacePanel, charts, UI…
│  └─ mobile/               # React Native + Expo SDK 57 + @rnmapbox/maps 10
│     └─ src/               # Écrans, contextes, i18n, lib, gamification
├─ packages/
│  └─ shared/               # Types (Artist…), dataset mondial géo, genres, popularité
├─ supabase/
│  ├─ migrations/           # 56 migrations SQL (schéma + RPC + RLS)
│  └─ functions/            # Edge functions : ai_verify, ai_artist_agent, purge-cache
├─ scripts/                 # Deploy, migrations, peuplement, audits, fixes data
├─ design/                  # Concepts HTML historiques + source Figma
└─ docs/                    # Cette documentation
```

**Responsabilités**
- `apps/web` : navigateur + Mapbox uniquement.
- `apps/mobile` : Expo/natif uniquement.
- `packages/shared` : aucune dépendance framework — source unique du catalogue, des pays et des genres.
- `supabase` : appartient au produit entier (pas à une app).

**Préfixes d'env distincts** : `VITE_*` (web) et `EXPO_PUBLIC_*` (mobile).

---

## 3. Stack technique

| Domaine | Choix |
|---|---|
| Web | React 19, Vite 8, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), lucide-react |
| Mobile | React Native 0.86, Expo SDK 57, @rnmapbox/maps 10, React Navigation, Ionicons |
| Carte | Mapbox GL v3 (web) / @rnmapbox/maps (mobile) — recette partagée bleu/lime : eau, atmosphère et frontières bleues ; végétation et accents lime |
| Backend | Supabase (auth, Postgres, RLS, Storage, Edge Functions) |
| IA | Mistral via edge functions (`ai_verify` correction genres/bios, `ai_artist_agent` deep-search) |
| Emails | SMTP Hostinger (`noreply@musimaps.com`) — envoi via `scripts/send-email.mjs` |
| Hébergement web | Hostinger (FTP/FTPS) — `musimaps.com`, cache purgé via `purge-hostinger-cache.mjs` |
| APK | Expo EAS (plan gratuit — quota mensuel, voir déploiement) |
| Avatars animés | Rive / Lottie (profil mélomane), photos pro pour les artistes |

**Identité de marque**
- `brand` (lime) : `#A8FF35` — accent, pulse, badges.
- `brandDeep` (bleu) : `#2F52E0` — actions, boutons, pins.
- Globe : bleu dominant (eau, atmosphère, frontières), lime en accent (végétation, labels sombres),
  palette et géométrie sémantiques identiques sur le web, sa preview et le mobile.
- Fond clair `warm-white`, sombre `#0b0c10` ; police display **Cabinet Grotesk**, corps **Satoshi**.
- Logo : icône double-pilule + wordmark « Musimaps » ; icône seule sur mobile/responsive, logo horizontal sur desktop.

---

## 4. Données (Supabase / Postgres)

### Tables principales

| Table | Rôle |
|---|---|
| `profiles` | Comptes (display_name, city, district, country, role artist/melomane, account_type personal/business/premium, favorite_genres, avatar_url, bio) |
| `map_artists` | Le catalogue : pins de la carte (name, genre, city, **district**, country, flag, lat, lng, bio, image, cover, source, platforms, socials, verified, claimed_by, events, followers) |
| `waitlist` | Demandes de référencement (email, artist_name, city, **district**, country, genre, links, photo, user_id, converted_at, map_artist_id) |
| `artist_claims` | Revendication de profil par un compte (pending/approved/rejected) |
| `follows` | Suivis artiste ↔ compte |
| `artist_views` | Analytics : vues de profil (unique par user/appareil, pays du visiteur) |
| `artist_likes` | Likes sur les profils artistes |
| `artist_stats` | Statistiques agrégées par artiste (vues, likes, abonnés) |
| `booking_plans` | Forfaits booking des artistes (nom, prix, devise, durée, actif) |
| `notifications` | Notifications (follow, like, booking, découverte) |
| `user_streaks` | Streaks de connexion (gamification) |
| `gamification` | Sync anonyme des badges/points/level (dashboard admin) |
| `admins` | Emails autorisés dans l'espace admin |
| `site_content` / `site_content_public` | CMS : sections éditables + versions publiées (badges, brand, sections…) |
| `cache_config`, `booking_plans`, `user_streaks` | Config, bookings, streaks |

### Principaux RPC

`add_or_update_map_artist` (upsert pin sécurisé), `admin_stats` / `admin_artist_stats` / `artist_stats_detail`
(tableau de bord), `reset_artist_stats`, `record_artist_view`, `count_artist_likes`,
`count_artist_followers`, `notify_artist_action` / `notify_booking_status` / `notify_discovery`,
`request_claim` / `review_claim`, `request_booking` / `update_artist_booking` / `get_artist_booking`,
`link_waitlist_to_account`, `my_referral_request`, `sync_claimed_profile` / `update_claimed_profile`,
`set_account_type`, `delete_my_account`, `is_subscriber` / `is_premium` / `is_business`,
`publish_section` / `restore_version`, `checkin` (streaks), `handle_new_user` (trigger).

### Edge functions (Supabase)

| Fonction | Rôle |
|---|---|
| `ai_verify` | Vérifie des candidats artistes (Mistral) : filtre les non-musiciens, corrige genre/bio. Utilisée dans la recherche (gating Musibrainz) et l'admin. |
| `ai_artist_agent` | Deep-search agentique (outils : search → détails → Wikidata → bio/photo → géocodage → verdict) quand la recherche de base est mince. |
| `purge-cache` | Purge du cache CDN/htaccess via l'admin. |

### Géographie (packages/shared/src/geo.ts)

- Dataset mondial : tous les pays ISO 3166-1 (code, noms FR/EN, continent, drapeau).
- `geoCountryOf(city, country)` : pays GÉOGRAPHIQUE (la ville prime, sinon le pays déclaré).
- `flagFor`, `countryByCode`, `countryByName`, `searchCountries`, `continentOf`.
- Villes connues du clustering : `CITY_TO_COUNTRY` (Abidjan→CI, Dakar→SN, Johannesburg→ZA…).

---

## 5. Scripts (racine)

| Commande | Rôle |
|---|---|
| `npm run dev:web` / `dev:mobile` | Serveurs de dev Vite / Expo |
| `npm run build:web` | Build web (tsc -b + vite build) |
| `npm run deploy` | Déploie `apps/web/dist` sur Hostinger (FTP) |
| `npm run deploy:web` | Build + déploiement |
| `npm run db:migrate` | Applique les migrations SQL à la base Supabase |
| `npm run populate:map` | Peuplement du catalogue depuis MusicBrainz + agent IA |
| `npm run purge` | Purge du cache Hostinger |

### Scripts dédiés (`scripts/`)

- `deploy-hostinger.mjs` — FTP/FTPS vers Hostinger (84 fichiers, nettoyage des obsolètes).
- `db-migrate.mjs` — pousse les migrations vers la base distante.
- `populate-map.mjs` — peuplement artistes (Musibrainz + IA), `--dry` pour tester.
- `fix-geo-country.mjs` — réparateur géographique audit-first : lecture seule par défaut ; `--apply`
  obligatoire ; ne déplace que les coordonnées aberrantes et refuse les preuves ambiguës.
- `waitlist-to-map.mjs` — conversion waitlist → carte.
- `audit-artists.mjs` / `audit-map-data.py` — audits de qualité des données.
- `backfill-images.mjs` — récupération d'images manquantes.
- `send-email.mjs` — envoi d'emails via SMTP Hostinger.
- `purge-hostinger-cache.mjs` — purge cache.
- `ai-artist-agent.mjs` — tests de l'agent IA.

---

## 6. Déploiement

### Web (production : `https://musimaps.com`)
1. `npm run build:web`
2. `npm run deploy` (FTP Hostinger — env dans `apps/web/.env.local` : `HOSTINGER_HOST/PORT/USER/PASS/REMOTE_DIR`)
3. Vérifier : les chunks JS sont nouveaux (hachages), `.htaccess` applique la politique de cache de l'admin.

### Base de données
- `npm run db:migrate` — applique les migrations en attente (base : `sminkhihrfcvpggamdsy`).
- Les migrations sont **idempotentes** (`IF NOT EXISTS`, `CREATE OR REPLACE`) quand c'est possible.

### Mobile (APK Expo)
- `cd apps/mobile && npx eas-cli build --platform android --profile production --non-interactive`
- ⚠️ **Quota EAS** : le plan gratuit a un quota mensuel de builds, épuisé à la mi-août 2026 (réinitialisation
  le **1er septembre 2026**). Pour builder avant : plan payant EAS ou build local avec SDK Android.

### Vérification rapide en production
```bash
curl -s https://musimaps.com/artistes | grep -oE 'assets/[A-Za-z0-9_-]+\.js' | sort -u
# puis grepper les chunks pour la présence des nouvelles chaînes/features
```

---

## 7. Accès & configuration

### Espace administrateur
- URL : `https://musimaps.com/admin` (route `/admin`).
- Login : **le premier compte créé devient administrateur** (table `admins`, RLS d'insertion à vide),
  ensuite `isAdminUser(email)` vérifie la table `admins`.
- Pages : Vue d'ensemble (stats + graphiques), Artistes découverts (modération + édition + IA + booking),
  Liste d'attente (conversion → carte), Réservations, Badges, Marque, Sections, SEO, Réglages,
  Historique, Docs, NavFooter, Gamification, Inscription artistes.

### Variables d'environnement
- `apps/web/.env.local` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_TOKEN`,
  `VITE_LAUNCH_DATE`, `HOSTINGER_*` (déploiement), SMTP (`send-email.mjs`).
- `apps/mobile/.env.local` : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_MAPBOX_TOKEN`.
- `scripts/` lit `apps/web/.env.local`.

### Email transactionnel
- SMTP Hostinger : compte `noreply@musimaps.com` — utilisé par `scripts/send-email.mjs`
  (mots de passe de réinitialisation, notifications). Jamais de secrets dans le repo.

---

## 8. Fonctionnalités clés (à jour)

- **Globe** : clustering hiérarchique Monde → pays → ville → sous-groupe (~2 km) → pins individuels ;
  clic cluster = zoom + scope des pins au cluster + atterrissage sur le PREMIER pin (position dés-empilée) ;
  mini-barre lieu avec flèches de navigation pin-à-pin (PlacePanel) ; boutons Vue Globe / Play-Pause ;
  rotation automatique interrompue au toucher (mode `moveTo` natif, parité web `jumpTo`) ;
  frontières pays teintées bleu brand ; pins **lumineux colorés par densité** (tier de popularité) ;
  géométrie web/mobile commune (pins 36 px, clusters 68 px, sous-clusters 44 px, pad 36 px) et nom du
  pin sélectionné lisible sur 200 px au-dessus des marqueurs voisins.
- **Recherche** : villes, pays, genres, quartiers (Mapbox), artistes ; gating Musibrainz : un artiste
  trouvé en ligne peut être ajouté/revendiqué, sinon référencement proposé.
- **Référencement artistes** : web + mobile, ville/pays (selects avec recherche) + **quartier/district**,
  géocodage par quartier (pin dans le vrai quartier), admin valide/corrige, conversion waitlist → carte.
- **Profils & comptes** : création de compte (artiste/mélomane), édition profil, mot de passe oublié/reset,
  changement email/mot de passe, suppression de compte, passage Premium/Business, avatar (photo pro artiste /
  avatar animé Rive-Lottie mélomane).
- **Engagement** : suivre / liker avec toasts, notifications (cloche avec fond arrondi), statistiques par
  pays des visiteurs, streaks de connexion, badges + points + niveaux (gamification), sync mobile ↔ web.
- **Booking** : artistes bookables (forfaits) visibles seulement pour les comptes Business.
- **CMS admin** : sections markdown + HTML, marque (logos), badges, SEO, versionnage, brouillons, i18n FR/EN.
- **i18n** : FR/EN sur web et mobile, choix de langue ou langue système.
- **Thème** : clair/sombre cohérent web ↔ mobile (carte monochrome, logos adaptés).

---

## 9. État actuel du travail (12 août 2026)

- ✅ Web déployé en production (dernier build : district + frontières brand + pays géo).
- ✅ Base migrée jusqu'à `00056_artist_district.sql`.
- ✅ Audit géographique propre : 121 artistes analysés, aucune incohérence ; l'artiste aberrant
  Not Zany a été supprimé de production avec ses dépendances vérifiées.
- ✅ Réparateur géographique sécurisé et couvert par cinq régressions (`npm run test:geo-repair`) :
  Not Zany/Kano, Dalida/Cairo, Apashe/Brussels et deux cas ambigus.
- ✅ Phase carte 3bis terminée (9/9) : le zoom mobile ne simule plus la caméra ; Mapbox v10 est la
  source unique, protégée par `npm run test:map-state`.
- ✅ Écrans mobiles `Confirmation` et `ArtistProfile` ajoutés sur le socle UI partagé ; la phase 4
  ne conserve plus que la complétude du formulaire `ArtistJoin`.
- ✅ Pins lumineux par densité (web `GlobeMap.tsx`/`index.css`, mobile `ExploreScreen.tsx`) : lint + tsc OK, web déployé.
- ⚠️ APK mobile : code prêt, build bloqué par le quota EAS (voir §6).

---

## 10. Dettes techniques & pistes connues

- Quota EAS mensuel (build APK) — passer en plan payant ou build local.
- `CITY_TO_COUNTRY` reste volontairement limité : les villes absentes utilisent le pays stocké et
  `npm run audit:geo` détecte les artistes éloignés de leur groupe.
- Le réparateur ne confond plus pays et coordonnées : un aberrant conserve son pays déclaré et peut
  seulement être re-géocodé dans celui-ci ; hors aberrant, le pays n'est réaligné que si le reverse
  Mapbox et le forward « ville, pays du pin » concordent. Sans `--apply`, aucune écriture.
- Recherche Musibrainz limitée à ~60 artistes auto-importés : l'agent IA compense, mais le peuplement
  populaire est en cours d'amélioration.

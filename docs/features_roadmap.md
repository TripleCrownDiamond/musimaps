# Musimaps — Fonctionnalités, Roadmap & Plan IA

Document de référence sur ce qui est **déjà construit**, les fonctionnalités
**possibles** à ajouter (avec priorité et points techniques), et un **plan IA**
concret qui s'appuie sur l'existant (Brainz, Wikipedia, Supabase).

---

## 1. Ce qui existe déjà

| Domaine | Fonctionnalité | Où |
|---|---|---|
| Découverte | Recherche MusicBrainz + Wikipedia (bio réelle, photos HD, liens), normalisation des genres | `apps/web/src/lib/discovery.ts`, `apps/mobile/src/lib/discovery.ts` |
| Peuplement auto | **Script cron `populate-map`** : moissonne MusicBrainz par ville, filtre musiciens (Wikidata P106), bio + photo HD (Wikipedia), géocode Mapbox, upsert via RPC, anti-politiciens/acteurs, dédupe par MBID, batch par run | `scripts/populate-map.mjs`, `docs/POPULATE-MAP.md`, migrations `00034` + `00035` |
| Carte | Globe épuré : 0 pin au départ, pins affichés selon la recherche (artiste/ville/genre), clic → fiche, zoom | `GlobeMap.tsx`, `GlobeExplore.tsx` |
| Recherche | Différenciée **Artistes / Villes / Genres** avec badges et compteurs | `GlobeExplore.tsx` |
| Profil | Fiche artiste (bio, sons auto via iTunes, événements, liens), page `/artist/:id`, followers réels | `ArtistSheet.tsx`, `ArtistProfile.tsx`, `lib/music.ts` |
| Revendication | L'artiste revendique son profil → l'admin valide → **sync du compte** (nom + ville) + édition photo/cover/bio/liens depuis le Dashboard | migrations `00031` + `00032`, `lib/profile.ts` |
| Abonnés | Compteur d'abonnés Musimaps réel (table `follows`), partagé web + mobile | `count_artist_followers` |
| Suivre / Like | Bouton **Suivre** (Supabase) distinct du **Like/Save** local | `lib/stats.ts` (web + mobile) |
| Booking | Demande de réservation (RPC sécurisé), gérée en admin, réservée aux comptes business | `BookingModal.tsx`, admin `BookingsPage` |
| Comptes | `personal` / `business` (booking) / `premium` (liens illimités, notifs) | migration `00029` |
| Notifications | Table `notifications` + RPC `notify_discovery` + cloche navbar | `lib/notifications.ts`, `NotificationBell.tsx` |
| Cache | Cache-busting `?v=N`, purge CDN, politique `.htaccess` gérée en admin | migration `00028`, admin `CachePage` |
| CMS | **Tout le contenu éditable en admin, bilingue FR/EN** : nav, hero, features, footer, copyright, stores, SEO/OG, FAQ | `apps/web/src/admin/`, `lib/cms.ts` |
| Admin | 17+ sections, bilingue, responsive mobile (drawer), design system lime/bleu | `apps/web/src/admin/` |
| Mobile | Dock de navigation en bas, thème lime/bleu, auth, globe, recherche, profil, gamification | `apps/mobile/` |

---

## 2. Pistes de fonctionnalités produit (par priorité)

### 🔥 P0 — Impact immédiat, faible coût

1. **Découverte par collectif / alias éditable**
   - `music.ts` accepte des collectifs connus en dur (Bakel City Gang, 92i…).
   - **À faire** : table `artist_aliases(artist_id, alias)` éditable en admin.

2. **Plus de sons par défaut**
   - Limite actuelle : 24 titres. **À faire** : bouton « Voir plus » qui recharge les 50 résultats iTunes bruts.

3. **« Suivre » vs « Like » clarifié + onglet Abonnements**
   - Bouton principal = **Suivre** ; cœur = favori local. **À faire** : onglet « Abonnements » dans le profil + Dashboard.

4. **Premium = liens illimités**
   - 1 plateforme + 1 réseau sociaux gratuits ; le reste est Premium. **À faire** : appliquer la règle à l'édition du profil revendiqué + upsell.

5. **Notifications utilisables**
   - **À faire** : préférences (immédiat / quotidien / jamais) + page « Mes notifications ».

### 🚀 P1 — Forte valeur produit

6. **Recommandations personnalisées** (fil « Découvertes » : même ville, genres préférés, artistes suivis) — s'appuie sur `favorite_genres`, `city`, `follows`.
7. **Push notifications mobiles** (`expo-notifications` + table `push_tokens` + cron/edge function).
8. **Revendication enrichie** : preuve (email pro, lien officiel) → badge vérifié, édition directe, règle Premium.
9. **Événements & dates de tournée** : table `events` + carte « prochains concerts ».
10. **Stats avancées artistes** : vues profil, vues pin, clics plateformes, abonnés, bookings.

### 💎 P2 — Différenciation

11. **Playlists de ville** (« Le son de Lagos ») générées depuis iTunes.
12. **Mode hors-ligne** mobile (artistes/villes visités).
13. **Scan musical (Shazam-like)** → amener vers l'artiste sur la carte.
14. **Communauté** : commentaires, signalements.
15. **Monétisation premium/business** (Stripe/PayPal in-app).

---

## 3. Plan IA — fonctionnalités à ajouter

L'IA est le levier le plus fort pour la **qualité des données**, la
**personnalisation** et la **rétention**. Toutes les briques sont classées par
priorité, avec le modèle suggéré et la donnée nécessaire. Deux stratégies
d'exécution possibles (voir §4) : **API externes** (recommandé, coût maîtrisé)
ou **self-hosted** (Vercel AI SDK / Ollama).

### 🔥 P0-IA — Qualité des données (automatisation, faible coût)

**A. Enrichissement automatique des profils (à la volée)**
- Au moment d'ajouter un artiste (Brainz ou admin), un LLM consolide : bio de
  2-3 phrases dans **la langue du visiteur**, genres normalisés, alias, ville
  d'origine. Vérifie ensuite que les **liens de plateformes** (YouTube,
  Spotify, Apple Music, Deezer…) pointent bien vers le bon artiste.
- Modèle : `gpt-4o-mini` / `gemini-2.0-flash` / Claude Haiku — **~1 000 tokens
  par profil**, coût quasi nul.
- Donnée : le payload Brainz déjà collecté par `populate-map`.

**B. Résumé des bio Wikipedia (déterministe via IA)**
- Les bios font 400 caractères. Un LLM produit une version **150-200 caractères**
  (2 phrases) dans la langue du visiteur → meilleure UX sur les fiches + SEO.
- Trigger : après l'upsert du cron, en tâche de fond.

**C. Déduplication & fusion d'artistes**
- Deux entrées pour le même artiste (Brainz + import manuel). Un LLM (ou un
  embedding `text-embedding-3-small` sur `nom + genre + ville`) propose des
  fusions ; l'admin valide en un clic. → **table `artist_merges`** + page admin
  « Fusions suggérées ».

**D. Modération automatique**
- Pour le booking, les bios éditées par les artistes et les commentaires :
  un LLM classe (ok / à vérifier / à rejeter) avec raison. L'admin ne traite
  que le « à vérifier ».
- **Requis** : respect des règles françaises (RGPD, lutte contre les contenus
  illicites — loi LCEN).

### 🚀 P1-IA — Personnalisation & découverte

**E. Recherche sémantique + « Découvertes » personnalisé**
- Embeddings (`text-embedding-3-small`, 1536 dims, ou `pgvector` natif) sur
  les profils artistes → recherche « un artiste afrobeats féminin de Lagos
  pour un mariage » fonctionne, pas seulement les mots exacts.
- Fil « Découvertes » : `pgvector` (cosine) sur les genres/city suivis →
  top 10 artistes proches non suivis. Notifications « Découvert ».
- Infra : colonne `map_artists.embedding vector(1536)` + RPC `match_artists`.

**F. Chatbot assistant « carte musicale »**
- Assistant de la carte : « Montre-moi des artistes de Lyon qui tournent »,
  « Qui est dans ma ville ? », « Des DJs pour un événement ». Répond avec
  **les vrais résultats de la base** (RAG sur pgvector, jamais de données
  inventées), et propose des actions (suivre, booking, ajouter).
- Stack : Vercel AI SDK + Supabase (pgvector) + streaming. Widget flottant web
  + intégration mobile.

**G. Résumés de profil dans la langue du visiteur**
- À la volée : la bio FR d'un artiste traduite/résumée en EN (et vice-versa)
  quand le visiteur change de langue. Cache court (1 jour).
- Améliore directement l'expérience bilingue du site.

### 💎 P2-IA — Différenciation

**H. Playlists de ville générées par IA**
- 10 titres représentatifs par ville (à partir des tops iTunes + genres locaux
  + embeddings de similarité). Titre éditorial généré par LLM.
- UI : page « Playlist : Le son de Lagos ».

**I. Scan musical (Shazam-like)**
- Écouter 10 s → identification (Auddly / AcrCloud) → amener vers l'artiste
  sur la carte. Intégration mobile.

**J. Prévisions de demande de booking**
- « Quels artistes réserver pour un festival reggae à Abidjan en été ? » —
  à partir des données de bookings, genres et géographie. Une fois qu'il y a
  assez de données (learning de la demande).

**K. Voix (mobile)**
- « Cherche les artistes de Kinshasa » par voix (reconnaissance vocale
  native) → recherche sémantique E.

---

## 4. Choix d'architecture IA (à décider avant d'implémenter)

| Option | Pour | Contre |
|---|---|---|
| **API cloud** (OpenAI / Gemini / Anthropic) via une edge function Supabase ou un endpoint Vercel | Mise en place en jours, qualité maximale, coût variable mais faible (mini-modèles) | Clé API à sécuriser (jamais côté client), coût par appel |
| **Self-hosted** (Ollama + modèle local, ex. `Llama-3.2-3B`) | Pas de coût par appel, données locales | Qualité moindre pour le français, nécessite un serveur GPU, plus de maintenance |
| **Hybride (recommandé)** | LLM cloud pour l'enrichissement/les résumés (batch, coût négligeable), `pgvector` gratuit dans Supabase pour la recherche sémantique | — |

**Principe de sécurité** : toute l'IA se fait **côté serveur** (edge function
Supabase ou endpoint Vercel avec clé secrète). Le client ne voit jamais de clé
API. Les RPC existants (`add_or_update_map_artist`, `match_artists`) restent la
seule porte d'écriture.

---

## 5. Schéma cible (extraits SQL — inclut les tables IA)

```sql
-- P0.1 : alias de collectifs par artiste (éditable admin)
CREATE TABLE artist_aliases (
  artist_id TEXT REFERENCES map_artists(id) ON DELETE CASCADE,
  alias     TEXT NOT NULL,
  PRIMARY KEY (artist_id, alias)
);

-- P0.5 : préférences de notifications
ALTER TABLE profiles
  ADD COLUMN notif_frequency TEXT DEFAULT 'immediate', -- immediate|daily|never
  ADD COLUMN notif_location  BOOLEAN DEFAULT true,
  ADD COLUMN notif_prefs     BOOLEAN DEFAULT true,
  ADD COLUMN notif_follows   BOOLEAN DEFAULT true;

-- P1.7 : push tokens mobiles
CREATE TABLE push_tokens (
  user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token    TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'expo',
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, token)
);

-- P1.9 : événements de tournée
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id TEXT REFERENCES map_artists(id) ON DELETE CASCADE,
  title TEXT NOT NULL, venue TEXT, city TEXT, country TEXT,
  date DATE NOT NULL, url TEXT, ticket_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- IA-E : recherche sémantique (pgvector, gratuit dans Supabase)
ALTER TABLE map_artists ADD COLUMN embedding vector(1536);

CREATE OR REPLACE FUNCTION match_artists(
  query_embedding vector(1536),
  match_count int DEFAULT 10
) RETURNS TABLE (
  id text, name text, genre text, city text, similarity float
) LANGUAGE sql STABLE AS $$
  SELECT id, name, genre, city,
         1 - (embedding <=> query_embedding) AS similarity
  FROM map_artists
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- IA-C : fusions suggérées (validées en admin)
CREATE TABLE artist_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_a TEXT REFERENCES map_artists(id),
  artist_b TEXT REFERENCES map_artists(id),
  reason TEXT,            -- explication du modèle
  status TEXT DEFAULT 'suggested', -- suggested|approved|rejected
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Ordre de priorité recommandé

1. **P0 produit** : aliases éditable (P0.1), « Voir plus » de sons (P0.2), onglet Abonnements (P0.3), règles Premium sur l'édition (P0.4), préférences notifs (P0.5).
2. **P0-IA** : enrichissement + résumés de bios par LLM (A + B), puis dédup (C) et modération (D) — les 4 tiennent dans une **même edge function** `ai_enrich`.
3. **P1-IA** : recherche sémantique `pgvector` + fil « Découvertes » (E).
4. **P1 produit** : push mobile (7), événements (9), stats artiste (10).
5. **P1-IA** : chatbot assistant (F) + résumés multilingues (G).
6. **P2** : playlists IA (H), scan (I), monétisation (voir §7), voix (K).

### Monétisation (détaillée au §7)

Le §7 décrit **5 sources de revenus** à déployer dans l'ordre :
premium freemium (7.1) → boost d'artistes (7.2) → commission booking (7.3) →
sponsoring playlists (7.5) → API données B2B (7.4). Le positionnement
concurrentiel (7.7) et la feuille de route (7.8) y sont détaillés.

Chaque piste est indépendante : elles peuvent être livrées séparément sans
casser l'existant (toutes les fonctions ont des replis silencieux quand la
table manque — pattern déjà en place dans le code).

### Enrichissement des données & sync mobile/web (déjà amorcé)

Depuis la migration **00040**, chaque vue artiste est journalisée
(`artist_views`) avec **identité utilisateur ou clé d'appareil anonyme**,
type (profil/pin) et **pays du visiteur** → vues **uniques par user**,
**fréquence de retour** et **stats par pays** dans le dashboard artiste
(RPC `artist_stats_detail`, réservé artiste/admin) + reset admin
(`reset_artist_stats`). Le mobile et le web écrivent dans la **même base**
(vues profil/pin, follows, favoris, bookings, gamification).

Idées pour continuer à enrichir les données et la sync :

1. **Horodatage & segmentation** : colonnes `artist_views.referrer` (carte,
   recherche, partage, notification), `artist_views.platform` (web/mobile/iOS/Android).
2. **Stats par source** : « combien de vues viennent de la carte vs la recherche vs un partage » — 1 requête de plus sur le journal existant.
3. **Vues par genre / par ville de l'artiste** : agréger le journal avec
   `map_artists.genre/city/country` → « quels genres performent dans ma ville ».
4. **Conversion follower / booking** : relier `follows` et `bookings` aux
   vues d'un viewer → « X visiteurs devenus abonnés », « Y abonnés ont réservé ».
5. **Retention hebdo** : cohortes « vus cette semaine revus la suivante » depuis `artist_views.created_at`.
6. **Sync mobile enrichie** : vues **hors-ligne** mises en file puis poussées,
   clic plateforme (Spotify/YouTube) compté côté mobile comme côté web.
7. **Country par géoloc réelle** : aujourd'hui le pays vient de la ville du
   profil connecté (ou rien pour l'anonyme) ; ajouter une résolution IP
   (edge function) pour les visiteurs non connectés.
8. **Export artiste** : bouton « Exporter mes stats (CSV) » dans le dashboard
   (même pattern que l'export admin gamification).

---

## 7. Monétisation & compétitivité

Le modèle économique de Musimaps peut s'appuyer sur **5 sources de revenus
indépendantes**, qui se renforcent entre elles. Chacune est listée avec son
**public cible**, son **mécanisme** (tables/RPC à créer), sa **priorité** et
son **impact concurrentiel**.

### 7.1 Freemium utilisateurs (subscription récurrente)

L'offre `personal` / `business` / `premium` existe déjà (migration `00029`).
Il s'agit de **donner du contenu au premium** pour qu'il soit désirable :

| Niveau | Prix indicatif | Contenus premium |
|---|---|---|
| **Free** | 0 € | Découverte, carte, recherche, 1 plateforme + 1 réseau social sur son profil, notifications de base |
| **Premium fan** | 2,99 €/mois ou 24 €/an | Mode hors-ligne, alertes illimitées (artistes suivis + villes), badges exclusifs, thèmes, pas de pubs, statistiques perso (villes visitées détaillées) |
| **Premium artiste** | 4,99 €/mois | Liens illimités (plateformes + réseaux), photo HD + cover, profil épinglé dans sa ville, stats avancées, badge « vérifié » |
| **Business** | 9,99 €/mois | Booking illimité (déjà en place), tableau de bord organisateur (historique, récurrence), visibilité « organisateur de confiance » |

- **Mécanisme** : `premium_tiers` + Stripe/PayPal (web) et `expo-in-app-purchases` / Play Billing (mobile). Un RPC `sync_subscription(user_id, tier, provider, status)` met à jour `profiles.account_type` + `subscriptions`.
- **Levier produit** : le premium est **visible sur la carte** (badge doré) → effet de statut qui pousse à l'achat.
- **Anti-churn** : les données restent toujours accessibles en lecture (on n'enlève jamais ce qui a été découvert), on limite seulement les **fonctions** (export, hors-ligne, alertes).

### 7.2 « Boost » d'artistes (placement payant, pay-per-feature)

Le cœur de la valeur de Musimaps est la **visibilité géographique**. Les
artistes émergents paieront pour être **plus visibles dans leur scène locale** :

| Formule | Prix indicatif | Effet |
|---|---|---|
| **Pin Boost** (par mois) | 9,99 € | Pin agrandi + halo, priorité dans les résultats de la ville |
| **À la une de la ville** | 29 €/mois | Position 1 du fil « Découvertes » de la ville + bannière sur la fiche ville |
| **Pack scène locale** | 49 €/trim. | Boost + badge « scène locale » + inclusion dans la playlist de la ville (cf. 7.5) |

- **Mécanisme** : colonnes `map_artists.boost_until timestamptz` + `map_artists.boost_level int`. Les requêtes trient `boost_level DESC, boost_until > now()`. Un RPC `apply_boost(artist_id, level, months)` valide le paiement puis prolonge la date.
- **Fairness** : le boost ne fait **jamais disparaître** un artiste non payant (il le place seulement en tête), pour ne pas dégrader l'expérience de découverte.
- **Note concurrence** : c'est le modèle de Bandsintown/Songkick (« featured »), mais appliqué à l'échelle **locale et émergente** — créneau que les géants ignorent.

### 7.3 Commission sur les réservations (marketplace)

Le booking (migration `00016`) est le flux qui a le plus de **valeur monétaire
réelle** : il relie un organisateur et un artiste.

- **Modèle** : commission de **8-10 %** prélevée à la **confirmation** de la réservation (pas à la demande — zéro friction à l'entrée).
- **Mécanisme** : ajouter `bookings.fee numeric` + `bookings.fee_status` (`quoted|paid|waived`). Le statut de la réservation passe de `pending → confirmed → paid`. L'artiste et l'organisateur voient le montant net/montant commission.
- **Prérequis produit** : faire de la réservation un vrai flux (devis → acceptation → paiement → contrat simple), pas seulement une prise de contact.
- **P2** : commission plafonnée pour les petits événements (favoriser l'adoption des micro-concerts).

### 7.4 Abonnement données & API (B2B)

Musimaps accumule une donnée **géographique musicale unique** (artistes par
ville, genres, scènes locales). C'est vendable en B2B :

| Client | Produit | Prix |
|---|---|---|
| Labels & manageurs | Rapports de scène (top artistes d'une ville, tendances de genres) | 99-299 €/mois |
| Festivals & salles | API « qui joue ici » (géolocalisée, export CSV/JSON) | sur devis |
| Offices de tourisme | Pages « scène musicale de la ville » co-brandées | 500-2000 €/an |
| Agences de booking | Accès API booking (volume) | sur devis |

- **Mécanisme** : une edge function `api_export` (clé API par client, table `api_clients`), pas de nouveau frontend. Les rapports réutilisent les RPC `admin_stats` et les agrégations de `map_artists`.
- **Note concurrence** : peu de concurrents vendent de la **donnée musique géolocalisée** — c'est un océan bleu (Songkick vend des listings de concerts, pas de la donnée de scènes).

### 7.5 Sponsoring de playlists & contenus éditoriaux

Les **playlists de ville** (P2 produit, piste 11) et les pages de scènes
sont des surfaces éditoriales sponsorisables :

- « Le son de Lagos, présenté par [marque] » → 500-1500 € par campagne.
- Bannières sur la fiche d'une ville (bar, salle de concert, festival, label) → 100-300 €/mois.
- **Mécanisme** : table `sponsorships(id, surface, client, url, logo, starts_at, ends_at)` + zone admin « Sponsors » (comme la page Cache, sans RPC nouveau).

### 7.6 Fonctionnalités d'extension (levier de rétention & compétitivité)

Au-delà des revenus, ces fonctionnalités rendent Musimaps **plus difficile à
copier** et augmentent le temps passé :

1. **Playlists de ville** (« Le son de Lagos ») — différenciateur signature, sponsorisable (7.5).
2. **Tournées & événements** (table `events`, piste 9) — rapproche de Bandsintown mais avec la couche carte.
3. **Scan musical Shazam-like** (piste 13) — la fonction « magique » qui amène du trafic organique massif.
4. **Communauté** : commentaires, signalements, classements de ville (piste 14) — le contenu généré par les utilisateurs rend le produit collant.
5. **Recommandations personnalisées** (piste 6) + **push mobile** (piste 7) — la boucle de retour qui fait revenir.
6. **Mode hors-ligne** (piste 12) — argument d'achat premium (7.1) et différenciateur mobile.
7. **Chatbot IA « carte musicale »** (IA-F) — l'assistant qui différencie de tout concurrent : interroger la carte en langage naturel.
8. **Données enrichies par l'IA** (IA A-D) — la **qualité** des données est la barrière d'entrée la plus solide : plus Musimaps a de profils enrichis (bio, liens vérifiés, photos), plus il est dur à copier.

### 7.7 Comparaison concurrentielle

| Concurrent | Force | Faiblesse | Réponse Musimaps |
|---|---|---|---|
| **Shazam** | Identification instantanée | Pas de carte, pas de scène locale | Scan musical (13) + carte |
| **Bandsintown / Songkick** | Tournées des gros artistes | Artistes émergents ignorés | Scènes locales, booking, playlists de ville |
| **Spotify** | Catalogue, playlists | Découverte géographique faible | Carte = le différenciateur principal |
| **RADAR / Deezer NEXT** | Mise en avant éditoriale | Pas géolocalisé, géré par une équipe éditoriale | Boost payant + IA à l'échelle de milliers de villes |
| **Startups locales** (cartes culturelles) | Connaissance locale | Sans données artistes, sans booking | Données Brainz+IA + booking + gamification |

**Positionnement résumé** : « La carte vivante de la musique » = le seul produit
qui combine **(1)** découverte géographique, **(2)** données artistes
enrichies automatiquement, **(3)** un marché de réservation local et **(4)**
une monétisation qui sert l'écosystème (boost, sponsor, commission) sans
abîmer l'expérience de découverte.

### 7.8 Feuille de route monétisation (ordre recommandé)

1. **Mois 1-2** : Premium fan/artiste (7.1) — le plus rapide à livrer, le compte tiers existe déjà.
2. **Mois 2-3** : Boost d'artistes (7.2) — monétise directement la fonction phare (la carte).
3. **Mois 3-6** : Commission booking (7.3) — une fois le flux de réservation enrichi (devis/acceptation).
4. **Mois 6-12** : Sponsoring playlists (7.5) puis API données B2B (7.4) — revenus qui évoluent avec le catalogue.

**Principe** : on monétise **après** avoir prouvé la valeur (le catalogue et la
carte d'abord, le paiement ensuite). Chaque source de revenu est un **levier
produit** (boost, sponsor, commission) — jamais un mur payant qui bloque la
découverte.

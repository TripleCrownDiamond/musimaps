# Audit de conformité design — web ↔ mobile

> Mesuré le 2026-08-12 sur le code réel, après le partage des tokens, de l'i18n
> et de la logique métier (phases 1 à 3 du plan de cohérence).

## État du socle

Le web possède son système shadcn. Le mobile dispose désormais d'un premier socle partagé, mais la
migration du catalogue d'écrans reste partielle.

| | Web | Mobile |
|---|---|---|
| Primitives d'UI | 17 (`components/ui/`, shadcn) | 7 (`Button`, `Input`, `Card`/`Field`/`Section`, `AuthLayout`, `PasswordInput`, `ScreenHeader`) |
| Composants métier | ~20 | 11 |

`Login`, `Signup`, `ForgotPassword`, `ResetPassword` et la vue Discover consomment déjà ce socle. Les écrans
non migrés réinventent encore leurs boutons et leurs champs en `StyleSheet` ; c'est désormais la
source principale de dérive.

## Ce que ça produit

### Couleurs qui contournent les tokens

| | Occurrences |
|---|---|
| Web (pages publiques) | ~3 |
| **Mobile** | **24** (était 91, puis 68) |

Le web est propre parce que Tailwind résout les classes vers les variables CSS
générées depuis `tokens.ts`. Le mobile écrivait `'rgba(255,255,255,0.55)'` en
clair, 68 fois dans les écrans historiques.

Conséquence : changer une couleur dans `tokens.ts` mettait à jour le web
intégralement et le mobile **partiellement**. La dérive de palette que la
phase 1 devait supprimer pouvait donc revenir par cette porte.

Deux familles ont été traitées :

1. **Les écrans** — Start, Badges, Profil et les écrans d'authentification
   consomment le socle et les tokens.
2. **Le voile de la carte** — halos de pin, étiquettes de nom, verre sombre de
   la mini-barre de lieu. Ces valeurs sont translucides par nature (elles
   laissent voir le globe) donc non dérivables de `surface`, qui est opaque.
   Elles vivent dans `mapOverlays` et sont émises en variables CSS pour le
   web : `rgba(13, 15, 19, 0.92)` et `#0B1420` étaient recopiés à l'identique
   dans `index.css` **et** dans le `StyleSheet` mobile.

Les 24 restantes se concentrent sur `PasswordGauge` (5), `StartScreen` (5,
volontaires — voile sur photo), `DashboardScreen` (3) et `AppBar` (3).

### Aucune échelle respectée sur mobile

| Propriété | Valeurs distinctes | Aujourd'hui |
|---|---|---|
| `borderRadius` | **36** au départ | **29** |
| `padding*` | **37** au départ | **35** |

Les primitives et les écrans migrés lisent les tokens partagés (`radii`, `spacing`). Les valeurs
encore signalées appartiennent au code historique à migrer — au premier rang `ExploreScreen`, qui
n'a été repris que sur ses couleurs.

## Écarts d'écran

| Écran | Web | Mobile | Verdict |
|---|---|---|---|
| `Dashboard` | **112** clés i18n | **25** | 87 manquantes |
| `ArtistProfile` | 408 lignes | ✅ créé | cover/avatar, bio, stats, titres, dates, liens, booking et artistes liés |
| `Confirmation` | 202 lignes | ✅ créé | parité waitlist, rôle, CTA, partage natif |
| `ProfileEdit` | 17 clés | **41** | **inversé** — le web n'a ni suppression de compte ni changement d'email |
| `Login` · `Signup` · `ResetPassword` | 13 / 41 / 14 | 14 / 41 / 15 | à parité |
| `ArtistSignup` | 489 lignes | 224 | contenu CMS côté web, formulaire simple côté mobile |

Les écrans d'authentification sont déjà alignés — c'est le travail i18n de la
phase 2 qui les a rapprochés. Le déséquilibre restant est concentré sur le
dashboard et les deux écrans absents.

## Plan, dans l'ordre des dépendances

### A. Socle de primitives mobile

**En cours.** `Button`, `Input`, `Card` / `Field` / `Section`, `AuthLayout`, `PasswordInput` et
`ScreenHeader` existent dans `apps/mobile/src/ui/` et lisent les tokens partagés. `Card` accepte
`onPress` : les écrans écrivaient chacun leur `Pressable` avec une opacité différente au pressé
(0,6 · 0,82 · 0,85). Il reste à compléter les primitives métier (`Badge`) au fil des migrations.

C'est la fondation : sans elle, chaque écran repris réintroduit des valeurs en
dur. **À faire en premier**, tout le reste en dépend.

### B. Migration des écrans vers les primitives

Reprendre les 11 composants et 14 écrans mobiles pour qu'ils consomment le
socle. Objectif chiffré : ramener les 91 couleurs en dur sous 10 (il en
restera pour les cas légitimes — halos de carte, dégradés) et les 38 rayons à
l'échelle `radii`.

**Fait** : `Login`, `Signup`, `ForgotPassword`, `ResetPassword`, `Discover`, `Start`, `Badges`,
`Profil`, `PlacePanel`, et les couleurs d'`ExploreScreen`. **91 → 24** couleurs en dur,
**36 → 29** rayons. `npm run design:check` verrouille chaque palier atteint.

**Reste** : `PasswordGauge`, `DashboardScreen`, `AppBar`, `SearchablePicker`, `ArtistSheet`,
`OnboardingScreen`, `ArtistJoinScreen`, `Charts`, `BookingModal` — et l'échelle d'espacement
d'`ExploreScreen`, qui tombera avec son découpage (phase F).

### C. Écrans manquants

`ConfirmationScreen` et `ArtistProfileScreen` sont construits sur le socle. La sheet carte est
redevenue un aperçu rapide et ouvre maintenant le profil complet.

### D. Dashboard à parité

De 25 à ~112 clés, découpé en sections (`StatsGrid`, `StreakCard`,
`RewardsSection`, `MyArtistsSection`, `PlansSection`, `ReferralCard`,
`AccountInfoSection`) plutôt qu'en un fichier de 1 400 lignes.

### E. Compte côté web

Suppression de compte et changement d'email — le seul écart où c'est le **web**
qui est en retard. Enjeu RGPD, déjà ouvert en tâche séparée.

## Garde-fou à ajouter

Un script `npm run design:check` qui échoue si :

1. une couleur en dur apparaît dans `apps/mobile/src` hors liste blanche ;
2. un `borderRadius` ou un `padding` sort des échelles `radii` / `spacing`.

Sans lui, B se défait tout seul en quelques semaines — exactement comme la
palette avait dérivé avant la phase 1.

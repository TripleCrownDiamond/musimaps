# Audit de conformité design — web ↔ mobile

> Mesuré le 2026-08-12 sur le code réel, après le partage des tokens, de l'i18n
> et de la logique métier (phases 1 à 3 du plan de cohérence).

## État du socle

Le web possède son système shadcn. Le mobile dispose désormais d'un premier socle partagé, mais la
migration du catalogue d'écrans reste partielle.

| | Web | Mobile |
|---|---|---|
| Primitives d'UI | 17 (`components/ui/`, shadcn) | 6 (`Button`, `Input`, `Card`, `AuthLayout`, `PasswordInput`, index) |
| Composants métier | ~20 | 11 |

`Login`, `Signup`, `ForgotPassword`, `ResetPassword` et la vue Discover consomment déjà ce socle. Les écrans
non migrés réinventent encore leurs boutons et leurs champs en `StyleSheet` ; c'est désormais la
source principale de dérive.

## Ce que ça produit

### Couleurs qui contournent les tokens

| | Occurrences |
|---|---|
| Web (pages publiques) | ~3 |
| **Mobile** | **68** |

Le web est propre parce que Tailwind résout les classes vers les variables CSS
générées depuis `tokens.ts`. Le mobile écrit `'rgba(255,255,255,0.55)'` en
clair, encore 68 fois dans les écrans historiques.

Conséquence : changer une couleur dans `tokens.ts` met à jour le web
intégralement et le mobile **partiellement**. La dérive de palette que la
phase 1 devait supprimer peut donc revenir par cette porte.

### Aucune échelle respectée sur mobile

| Propriété | Occurrences | Valeurs distinctes |
|---|---|---|
| `borderRadius` hors tokens | — | **36 occurrences** |
| `padding*` | 238 | **37** |

Les nouvelles primitives lisent les tokens partagés (`radii`, `spacing`). Les 36 occurrences encore
signalées appartiennent au code historique à migrer.

## Écarts d'écran

| Écran | Web | Mobile | Verdict |
|---|---|---|---|
| `Dashboard` | **112** clés i18n | **25** | 87 manquantes |
| `ArtistProfile` | 408 lignes | **absent** | à créer |
| `Confirmation` | 202 lignes | **absent** | à créer |
| `ProfileEdit` | 17 clés | **41** | **inversé** — le web n'a ni suppression de compte ni changement d'email |
| `Login` · `Signup` · `ResetPassword` | 13 / 41 / 14 | 14 / 41 / 15 | à parité |
| `ArtistSignup` | 489 lignes | 224 | contenu CMS côté web, formulaire simple côté mobile |

Les écrans d'authentification sont déjà alignés — c'est le travail i18n de la
phase 2 qui les a rapprochés. Le déséquilibre restant est concentré sur le
dashboard et les deux écrans absents.

## Plan, dans l'ordre des dépendances

### A. Socle de primitives mobile

**En cours.** `Button`, `Input`, `Card`, `AuthLayout` et `PasswordInput` existent dans
`apps/mobile/src/ui/` et lisent les tokens partagés. Il reste à compléter les primitives métier
(`Badge`) au fil des migrations ; `Section` est déjà exposée par le socle.

C'est la fondation : sans elle, chaque écran repris réintroduit des valeurs en
dur. **À faire en premier**, tout le reste en dépend.

### B. Migration des écrans vers les primitives

Reprendre les 11 composants et 14 écrans mobiles pour qu'ils consomment le
socle. Objectif chiffré : ramener les 91 couleurs en dur sous 10 (il en
restera pour les cas légitimes — halos de carte, dégradés) et les 38 rayons à
l'échelle `radii`.

### C. Écrans manquants

`ArtistProfileScreen` et `ConfirmationScreen`, construits directement sur le
socle. Les clés i18n existent déjà des deux côtés depuis la phase 2.

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

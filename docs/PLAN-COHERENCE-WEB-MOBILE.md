# Plan technique — Cohérence visuelle et fonctionnelle web ↔ mobile

> Établi le 2026-08-11, à partir d'un audit du code réel.
> Point de départ : commit de sauvegarde `e2819dc` sur `backup/monorepo-etat-actuel`.

## Principe directeur

**On ne fusionne pas l'UI, on fusionne ce qui la nourrit.**

Le web (Vite + Tailwind v4 + shadcn/Radix) et le mobile (Expo + StyleSheet) gardent
chacun leur couche de rendu — c'est ce qui préserve le design web exact et le flow
natif mobile. Ce qu'on met en commun : les **tokens**, les **textes**, la **logique
métier**. L'incohérence actuelle ne vient pas d'avoir deux UI, elle vient d'avoir
deux copies divergentes de tout le reste.

---

## Constat mesuré

### 1. Tokens dupliqués et déjà en dérive

`apps/mobile/src/theme.ts` a été écrit à la main « d'après » `apps/web/src/index.css`.
Les deux ont déjà divergé :

| Token | Web (`index.css`) | Mobile (`theme.ts`) | Écart |
|---|---|---|---|
| `brandSoft` (clair) | `#E4EAFB` (bleu) | `#F1FBDE` (vert) | **teinte différente** |
| `hairline` (clair) | `0.05` / `0.10` (2 niveaux) | `0.08` (1 seul) | granularité perdue |
| `hairline` (sombre) | `0.09` / `0.16` | `0.14` | valeurs différentes |
| `success` (sombre) | `#22C55E` (non redéfini) | `#40D99A` | **couleur différente** |

Toute correction de palette faite d'un côté ne se propage pas de l'autre.

### 2. Textes dupliqués et massivement désynchronisés

| | Clés |
|---|---|
| `apps/web/src/i18n/translations.ts` | **457** |
| `apps/mobile/src/i18n/index.tsx` | **369** |
| **Communes aux deux** | **193** |

264 clés n'existent que sur le web, 176 que sur mobile. Les deux plateformes
racontent littéralement deux produits différents.

### 3. Logique métier dupliquée (~2 900 lignes web / ~2 500 mobile)

| Module | Web | Mobile | Dérive |
|---|---|---|---|
| `discovery.ts` | 1710 | 1325 | **385 lignes** |
| `stats.ts` | 332 | 207 | 125 |
| `auth.ts` | 263 | 260 | 3 |
| `gamification` | 148 | 200 | 52 |
| `music.ts` | 158 | 144 | 14 |
| `booking.ts` | 104 | 127 | 23 |
| `brand.ts` | 44 | 80 | 36 |
| `notifications` / `searchHistory` / `supabase` | 148 | 145 | ~3 |

`discovery.ts` est le pire cas : c'est l'enrichissement MusicBrainz, donc **un artiste
n'est pas découvert de la même façon sur web et sur mobile**.

### 4. Écrans mobiles manquants ou atrophiés

| Web | Mobile | Verdict |
|---|---|---|
| `/artist/:id` — `ArtistProfile.tsx` (408 l.) | **aucun écran** | ❌ absent |
| `/merci` — `Confirmation.tsx` (202 l., 30 clés) | **aucun écran** | ❌ absent |
| `/dashboard` — `Dashboard.tsx` (1422 l., **105 clés**) | `DashboardScreen` (349 l., **18 clés**) | ⚠️ moignon |
| `/artistes` — `ArtistSignup.tsx` (489 l.) | `ArtistJoinScreen` (224 l.) | ⚠️ moitié |
| `/globe` — `GlobeExplore` (1512) + `GlobeMap` (849) | `ExploreScreen` (2258 l. **monolithe**) | ⚠️ non découpé |

Détail des trois points que tu as signalés :

- **Pages artiste** — le mobile n'a *aucune* navigation vers un détail artiste.
  `grep` sur `ArtistProfile|navigate('Artist` ne renvoie que `ArtistJoin`. Toute la
  consultation passe par `ArtistSheet` (bottom sheet, 687 l.), là où le web offre une
  page dédiée. D'où la sensation d'étouffement : on tape un artiste et on reçoit un
  tiroir, pas une page.
- **Résultat compte / auth** — `SignupScreen.tsx:158` fait `navigation.navigate('Dashboard')`.
  Brut. Le web a une page de confirmation complète : badge de rôle, position dans la
  liste d'attente, cartes « et maintenant », partage, prochaines étapes.
- **Dashboard** — le mobile n'a ni badges/récompenses, ni streak, ni checklist
  d'onboarding, ni « mes artistes », ni infos de compte / bascule perso↔business, ni
  offres de booking, ni parrainage, ni gestion photo/cover. Il invente en plus une clé
  `dash.chartAudience` qui n'existe pas côté web.

---

## Le plan, en 6 phases

Chaque phase est autonome, livrable et réversible. Ordre choisi pour que les fondations
soient posées avant qu'on touche à un seul écran — sinon on refait le travail deux fois.

### Phase 0 — Sécuriser la base (½ j) · risque : nul

1. Ajouter au `.gitignore` : `musimaps-hostinger.zip`, `.freebuff/`, `supabase/.temp/`.
2. Fusionner `backup/monorepo-etat-actuel` dans `main` pour que l'historique reparte propre.
3. Vérifier que `npm run check` (build web + typecheck mobile) passe. **C'est le filet
   de sécurité de toutes les phases suivantes** : aucune phase n'est terminée tant qu'il
   ne repasse pas au vert.

### Phase 1 — Tokens partagés (1 j) · risque : faible

Créer `packages/shared/src/design/tokens.ts` : **source unique**, en TypeScript pur,
sans dépendance à React ni à une plateforme.

```ts
export const palette = {
  light: { background: '#FAF7F5', brandSoft: '#E4EAFB', /* … */ },
  dark:  { background: '#0D0F13', brandSoft: '#1E2A44', /* … */ },
}
export const typography = { display: 'Cabinet Grotesk', body: 'Satoshi', /* … */ }
export const radii = { /* … */ }
export const spacing = { /* … */ }
```

- **Web** : un petit script génère le bloc `@theme` / `:root[data-theme='dark']` de
  `index.css` depuis `tokens.ts`. Les classes Tailwind existantes ne bougent pas → **zéro
  changement visuel sur le web**, c'est le point critique.
- **Mobile** : `theme.ts` ne définit plus de valeurs, il ne fait que mapper `palette`
  vers `lightColors` / `darkColors`. Les `StyleSheet` existants continuent de marcher.

Arbitrage à trancher au passage : `brandSoft` clair devient `#E4EAFB` (bleu, la valeur
web) — le vert mobile était une dérive. Et `success` sombre s'aligne.

**Vérification** : capture avant/après de la landing et du dashboard web, comparaison
pixel. Aucune différence attendue.

### Phase 2 — i18n partagé (2 j) · risque : faible, volume élevé

Déplacer les catalogues dans `packages/shared/src/i18n/` (`fr.ts`, `en.ts`), et n'y
laisser que des **données**. Chaque app garde son propre provider React (le web lit la
langue dans l'URL `/en/…`, le mobile via `expo-localization` — ça reste séparé).

Méthode pour les 193 communes / 264 web-only / 176 mobile-only :

1. Fusionner en union, web prioritaire en cas de conflit de formulation (c'est la
   référence produit).
2. Les clés mobile-only qui font doublon sémantique (`dash.chartAudience` vs
   `dash.chartEngagement`) sont fusionnées, pas empilées.
3. Ajouter un test qui échoue si `fr` et `en` n'ont pas exactement le même jeu de clés.

**Bénéfice immédiat** : les 264 textes qui manquaient au mobile deviennent disponibles.
Les phases 4–6 en dépendent directement.

### Phase 3 — Logique métier partagée (3–4 j) · risque : moyen

Ordre imposé : **du moins risqué au plus risqué**, un module par commit.

1. `supabase.ts` — d'abord l'adaptateur de stockage :
   ```ts
   export interface Storage {
     get(k: string): Promise<string | null>
     set(k: string, v: string): Promise<void>
     remove(k: string): Promise<void>
   }
   ```
   Web l'implémente sur `localStorage`, mobile sur `AsyncStorage`. C'est la seule vraie
   différence de plateforme dans toute cette couche.
2. `searchHistory` · `notifications` · `brand` — petits, dérive faible.
3. `booking` · `music` · `auth` — moyens.
4. `stats` · `gamification` — dérive à arbitrer.
5. `discovery` — **en dernier, seul, avec attention**. 385 lignes d'écart. Il faut
   d'abord diffuser les deux versions et décider ligne à ligne laquelle gagne. Ne pas
   le faire à la va-vite : c'est le module qui alimente la carte.

**Vérification par module** : `npm run check` + test manuel du parcours concerné sur les
deux plateformes avant de passer au suivant.

### Phase 4 — Les écrans mobiles manquants (3 j) · risque : faible

C'est ici que le mobile cesse d'être « bizarre ». Rendu possible par la phase 2.

1. **`ArtistProfileScreen`** — nouvel écran plein, poussé sur la `RootStack`. Reprend la
   structure de `ArtistProfile.tsx` (web) : header cover + avatar, bio, genres, liens
   plateformes, stats, bouton booking, artistes liés. `ArtistSheet` reste, mais devient
   ce qu'il aurait dû être : un aperçu rapide depuis la carte, avec un « Voir le profil »
   qui pousse le nouvel écran.
2. **`ConfirmationScreen`** — remplace le `navigate('Dashboard')` sec de
   `SignupScreen.tsx:158`. Reprend les 30 clés `confirm.*` déjà écrites côté web : badge
   de rôle, position waitlist, cartes « et maintenant », partage natif via `Share` RN.
3. **`ArtistJoinScreen`** — compléter les champs manquants par rapport à
   `ArtistSignup.tsx` (489 l. vs 224).

### Phase 5 — Dashboard mobile à parité (3 j) · risque : faible

`DashboardScreen` passe de 18 à ~105 clés. Découpé en composants, pas en un fichier de
1400 lignes :

`<StatsGrid>` · `<StreakCard>` · `<OnboardingChecklist>` · `<RewardsSection>` ·
`<MyArtistsSection>` · `<BookingsSection>` · `<PlansSection>` · `<ReferralCard>` ·
`<AccountInfoSection>`

Ces composants correspondent 1:1 aux sections web. Même ordre, mêmes données, mêmes
libellés — rendu natif. Ajouter au passage la porte d'authentification
(`dash.loginTitle` / `dash.loginText`) que le mobile n'a pas.

### Phase 6 — Découper le globe mobile (2 j) · risque : moyen

`ExploreScreen.tsx` fait **2 258 lignes**. Le web sépare la carte (`GlobeMap`, 849) de
l'écran (`GlobeExplore`, 1512) ; le mobile mélange tout. Appliquer la même découpe :

- `components/GlobeMap.native.tsx` — uniquement `@rnmapbox/maps` : caméra, pins,
  clusters, gestes.
- `screens/ExploreScreen.tsx` — orchestration, panneaux, recherche, filtres.
- Aligner l'API du composant carte sur celle du web (`onSelectArtist`, `onMoveEnd`,
  `focus`) même si l'implémentation diffère : la cohérence est dans le contrat, pas dans
  le rendu.

Phase volontairement placée en dernier : c'est l'écran le plus utilisé, on n'y touche
qu'une fois toutes les fondations stables.

---

## Récapitulatif

| Phase | Objet | Durée | Risque |
|---|---|---|---|
| 0 | Sécuriser git + `npm run check` vert | ½ j | nul |
| 1 | Tokens partagés | 1 j | faible |
| 2 | i18n partagé | 2 j | faible |
| 3 | Logique métier partagée | 3–4 j | moyen |
| 4 | Écrans mobiles manquants | 3 j | faible |
| 5 | Dashboard mobile à parité | 3 j | faible |
| 6 | Découpe du globe mobile | 2 j | moyen |

**Total ≈ 14–15 jours.** Aucune ligne d'UI web modifiée sur l'ensemble du plan — le
design web reste exact par construction. Le flow mobile splash → onboarding → welcome
reste intact : les phases 4–6 ajoutent et découpent, elles ne retirent rien.

## Ce que le plan ne fait pas

- **Pas de react-native-web, pas d'UI unifiée.** Tailwind v4 + shadcn + Radix n'ont pas
  d'équivalent RN ; les unifier signifierait réécrire 25 000 lignes de web et perdre
  précisément le design qu'on veut préserver.
- **Pas de partage des composants visuels.** Le contrat partagé s'arrête aux tokens, aux
  textes et à la logique. `Button` web et `Button` mobile restent deux fichiers — mais
  ils lisent la même couleur et le même libellé.
- **L'admin (20+ pages) reste web uniquement.** Aucune raison de le porter.

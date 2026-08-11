# Audit carte / globe — web ↔ mobile

> Établi le 2026-08-11 par lecture ligne à ligne de :
> `apps/web/src/components/GlobeMap.tsx` (849 l.) · `apps/web/src/pages/GlobeExplore.tsx` (1512 l.)
> `apps/mobile/src/screens/ExploreScreen.tsx` (2258 l.) · les deux `PlacePanel.tsx`
> `apps/web/src/index.css` (styles `.artist-pin`, l. 324-670)

---

## 1. Ce qui est déjà aligné

Bonne nouvelle : le socle mathématique de la carte est **identique** des deux côtés.

| Concept | Valeur | Web | Mobile |
|---|---|---|---|
| Seuils de cluster | `country <3.2` · `city <6` · `sub <9` · `spread ≥9` | `GlobeMap.tsx:314` | `ExploreScreen.tsx:199` |
| Bucket de regroupement | `0.02°` (~2,2 km) | `SPREAD_BUCKET_DEG` | `SPREAD_BUCKET` |
| Dés-empilement | angle d'or `2.399963229728653`, rayon `(0.012 + 0.007·√i) × spreadFactor` | `declump()` | `declump()` |
| Facteur d'écartement | `min(1.9, max(1, 1 + (z−9)·0.13))` | l. 154 | l. 129 |
| Échelle du pin | `min(1.15, max(0.22, 0.22 + (z−1)·0.07))` | l. 423 | l. 998 |
| Zoom max | `18` | l. 339 | l. 1316 |
| Tiers de popularité | 10 K / 100 K / 1 M → 4 niveaux | `@musimaps/shared` | `@musimaps/shared` |
| Couleurs d'anneau | gris `#7C8698` · bleu `#2F52E0` · bleu profond `#1E3AA8` · lime `#A8FF35` | partagé | partagé |

**Mais** : `declump`, `bucketKey`, `clusterBy`, `tierOf`, `hexToRgba`, `isValidCoordinate` sont
**copiés-collés** dans les deux fichiers. Ils sont identiques *aujourd'hui* — rien ne garantit
qu'ils le restent. C'est le même mécanisme de dérive que `discovery.ts` (385 lignes d'écart).

---

## 2. Divergences confirmées

### 2.1 🔴 Le zoom de sélection d'artiste — 4 niveaux d'écart

La fonction `goToArtist` est la même des deux côtés (même nom, mêmes étapes, même ordre) sauf
sur la dernière ligne :

| | Appel | Zoom | Durée |
|---|---|---|---|
| Web `GlobeExplore.tsx:359` | `flyTo(artist.coordinates, 13)` | **13** | 2600 ms |
| Mobile `ExploreScreen.tsx:607` | `flyTo(artist.coordinates, 9, 800)` | **9** | 800 ms |

Même écart sur le chemin « artiste déjà présent » (web `:660` → 13, mobile `:824` → 9) et sur la
sélection depuis la fiche (web `:703` → 13, mobile `:1109` → 9).

**Conséquence** : `9` est exactement la frontière `sub`/`spread`. En cherchant un artiste sur
mobile on atterrit au bord du niveau sous-cluster — les pins ne sont pas encore dés-empilés, la
spirale n'est pas ouverte. Sur web on arrive au niveau quartier avec les pins bien séparés.
**C'est la première cause de la sensation de navigation bizarre.**

### 2.2 🔴 Le vol atterrit à côté du pin (les deux plateformes)

`goToArtist` vole vers `artist.coordinates` — la coordonnée **brute**. Or à z13, si l'artiste
partage sa position géocodée avec d'autres, `declump` le décale en spirale de plusieurs centaines
de pixels. On centre donc la caméra sur un point *où il n'y a pas de pin*, et l'artiste cherché
se retrouve en périphérie.

Le web a pourtant déjà la fonction correcte — `focusArtist` (`GlobeMap.tsx:437`) recalcule le
dés-empilement au zoom cible avant de voler, avec un commentaire explicite l. 23-27. Elle n'est
utilisée que pour la navigation flèche-à-flèche (`GlobeExplore.tsx:493`), **jamais pour la
recherche**. Mobile ne l'a pas du tout : il inline `declump` à certains endroits (`:641`, `:683`,
`:742`, `:1376`) et pas à d'autres (`:607`, `:860`, `:1109`).

### 2.3 🟠 Durées de vol : mobile 3× plus rapide

| Action | Web | Mobile |
|---|---|---|
| `flyTo` par défaut | 2600 ms | 900 ms |
| Focus artiste | 1400 ms | 800-950 ms |
| Clic cluster | 1600 ms | 950 ms |
| Retour vue globe | 2000 ms | 900 ms |

Le web déroule un mouvement de caméra posé (`curve: 1.6`) ; le mobile coupe court. Les clusters
n'ont pas le temps de se scinder progressivement — d'où l'impression de saut.

### 2.4 🟠 Le zoom mobile a deux sources de vérité

`ExploreScreen.tsx:521` lance un `setInterval` à 60 ms qui **interpole `mapZoom` en parallèle** de
l'animation native de la caméra, pour que le clustering se mette à jour pendant le vol. Mais
`loadRegion` (`:1006`) écrit *aussi* `mapZoom` depuis les événements réels de la carte. Deux
écrivains concurrents sur le même état, avec un seuil anti-rebond de `0.02` de chaque côté.

Le web n'a pas ce problème : il lit le zoom réel via `map.on('zoom')` (`:499`).

### 2.5 🟡 Divergences mineures

| Point | Web | Mobile |
|---|---|---|
| Opacité du pin par zoom | `min(1, max(0.5, 0.5 + (z−1)·0.06))` (`:424`) | **absente** |
| Affichage du nom | au survol uniquement | `mapZoom >= 12.5` (`:265`) |
| `spreadFactor` | calculé hors boucle (`:154`) | recalculé dans la boucle (`:129`) |
| Fond du `PlacePanel` | `bg-black/45` | `rgba(8,12,18,0.55)` |
| Bordure du `PlacePanel` | `white/15` | `rgba(255,255,255,0.18)` |
| Rotation auto | `requestAnimationFrame` + `jumpTo`, −0.06°/frame | `setInterval` 120 ms |

Sur l'affichage du nom : le web ne l'affiche qu'au survol — donc **jamais au tactile**. Un
utilisateur web sur mobile ne voit aucun nom de pin.

---

## 3. Manques communs — les trois demandes

### 3.1 La taille du pin ne dépend pas de la notoriété

**Demandé** : en vue globe, des points brillants dont la taille varie selon la fame de l'artiste.

**Actuel** : le tier de popularité ne pilote que la **couleur** et le **halo**.
- Web `index.css:341` → `.artist-pin { width: 36px; height: 36px }`, fixe.
- Mobile `ExploreScreen.tsx:999` → `pinSize = max(11, round(34 × pinScale))`.

`pinScale` ne dépend que du zoom. Deux artistes au même endroit, l'un à 3 M d'auditeurs et l'autre
à 200, ont **exactement le même diamètre**. En vue globe (z<3.5, scale 0.22 → ~8 px) tous les
points sont des pastilles identiques : la carte ne raconte rien.

**Correction** : introduire un facteur de notoriété multiplicatif, appliqué **en plus** de
l'échelle de zoom, dans un module partagé :

```ts
// packages/shared/src/map/pins.ts
export const TIER_SIZE_FACTOR: Record<PopularityTier, number> = {
  0: 0.72,  // discret — petit point
  1: 0.88,
  2: 1.06,
  3: 1.30,  // très populaire — point large et lumineux
}
export function pinScaleFor(zoom: number, tier: PopularityTier): number {
  const base = Math.min(1.15, Math.max(0.22, 0.22 + (zoom - 1) * 0.07))
  return base * TIER_SIZE_FACTOR[tier]
}
export function pinGlowFor(zoom: number, tier: PopularityTier): number {
  // Le halo croît plus vite que le diamètre : en vue globe on lit la
  // notoriété au rayonnement, pas à la taille (déjà minuscule).
  return (0.35 + tier * 0.22) * Math.min(1, Math.max(0.45, zoom / 6))
}
```

Web consomme via `--pin-scale` / `--pin-tier-glow` (les variables CSS existent déjà, seule leur
valeur change) ; mobile via `pinSize` et l'opacité du halo. **Aucun changement structurel** —
uniquement la formule, et elle devient partagée.

### 3.2 Le nom de l'artiste courant est absent de la nav pin-à-pin

**Demandé** : quand la navigation entre pins apparaît, afficher le nom de l'artiste courant.

**Actuel** : les deux `PlacePanel` affichent `flag + place.name + count` — « 🇸🇳 Dakar · 12 artistes ».
La variable `current` est bien calculée (`PlacePanel.tsx:38` des deux côtés) et utilisée pour le
`onSelect`… mais **jamais rendue**. On navigue à l'aveugle entre 12 artistes sans savoir sur lequel
on est.

**Correction** : le pill devient deux lignes — nom de l'artiste en principal, lieu et position en
secondaire :

```
‹   Awa Diop                    ›   ✕
    🇸🇳 Dakar · 3/12
```

Même structure des deux côtés, même hiérarchie typographique. Ajouter la clé `place.position`
(`{index}/{count}`) au catalogue i18n partagé.

### 3.3 Le recentrage sur recherche ne cible pas le pin affiché

Voir §2.2. **Correction** : une seule fonction partagée pour décider *où* poser la caméra —

```ts
// packages/shared/src/map/camera.ts
export const CAMERA = {
  artist:  { zoom: 13,   duration: 1400 },
  city:    { zoom: 13,   duration: 1600 },
  place:   { zoom: 14,   duration: 1600 },
  country: { zoom: 12,   duration: 1600 },
  genre:   { zoom: 11,   duration: 1600 },
  sub:     { zoom: 13.5, duration: 1400 },
  globe:   { zoom: 0.75, duration: 2000 },
} as const

/** Position AFFICHÉE d'un artiste au zoom cible (dés-empilement inclus). */
export function renderedPosition(
  artists: Artist[], id: string, zoom: number,
): [number, number] | undefined
```

Chaque plateforme garde son moteur d'animation (`map.flyTo` Mapbox GL vs `camera.setCamera`
`@rnmapbox`) mais lit **la même cible et le même zoom**.

---

## 4. Plan de correction carte

À insérer comme **phase 3bis** du [plan de cohérence](PLAN-COHERENCE-WEB-MOBILE.md), après le
partage de la logique métier et avant la découpe du globe (phase 6).

| # | Action | Fichiers | Risque |
|---|---|---|---|
| 1 | Extraire `packages/shared/src/map/` : `declump`, `bucketKey`, `clusterBy`, `tierOf`, `levelFor`, `isValidCoordinate` | shared + 2 appels | faible |
| 2 | Ajouter `pinScaleFor` / `pinGlowFor` — **taille par notoriété** (§3.1) | shared + `index.css` + `ExploreScreen` | faible |
| 3 | Ajouter la table `CAMERA` et `renderedPosition`, remplacer **tous** les `flyTo` littéraux | shared + 2 écrans | **moyen** |
| 4 | Aligner le zoom mobile de `goToArtist` sur 13 (§2.1) | `ExploreScreen.tsx:607,824,1109` | faible |
| 5 | Faire voler `goToArtist` sur la position dés-empilée (§2.2), les deux plateformes | 2 écrans | faible |
| 6 | Aligner les durées de vol sur la table `CAMERA` (§2.3) | 2 écrans | faible |
| 7 | Afficher le nom de l'artiste courant dans `PlacePanel` (§3.2) | 2 `PlacePanel` + i18n | faible |
| 8 | Supprimer le zoom fantôme mobile, dériver du `setCamera` réel (§2.4) | `ExploreScreen.tsx:521-547` | **moyen** |
| 9 | Ajouter l'opacité par zoom sur mobile, aligner le seuil d'affichage du nom (§2.5) | `ExploreScreen` | faible |

**Estimation : 3 à 4 jours.** Les étapes 3 et 8 sont les seules à surveiller — elles touchent la
caméra, donc tout le ressenti de navigation. À faire chacune dans son propre commit, avec test
manuel des 6 parcours du §5.

---

## 5. Parcours de recette (à rejouer sur les deux plateformes)

Toute modification de la carte doit passer ces 6 parcours, web **et** mobile :

1. **Vue globe au repos** — les pins sont de petits points brillants ; leur taille varie
   visiblement selon la notoriété ; la rotation tourne sans saccade.
2. **Recherche d'artiste** — la caméra vole en ~1,4 s, atterrit au niveau quartier, et le pin
   cherché est **au centre exact**, mis en évidence, son nom affiché.
3. **Recherche de lieu** — le vol atterrit sur un pin visible, jamais sur un barycentre vide.
4. **Clic sur cluster pays** — les clusters se scindent progressivement pays → villes → groupes →
   pins pendant le vol, en un seul clic.
5. **Navigation flèche-à-flèche** — chaque saut recentre le pin suivant, le panneau affiche le nom
   de l'artiste courant et sa position (`3/12`).
6. **Retour vue globe** — la rotation reprend, les pins redeviennent des points, aucun pin
   résiduel en haut à gauche.

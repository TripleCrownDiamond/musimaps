# Règles d'évolution, de correction de bug et de cohérence

> Musimaps est un monorepo à **deux surfaces** (`apps/web` Vite+React, `apps/mobile` Expo+RN)
> qui doivent raconter **un seul produit**. Ces règles existent parce que l'audit du 2026-08-11 a
> montré comment la dérive s'installe : personne ne l'a décidée, elle est arrivée fichier par
> fichier. Voir [AUDIT-CARTE.md](AUDIT-CARTE.md) et [PLAN-COHERENCE-WEB-MOBILE.md](PLAN-COHERENCE-WEB-MOBILE.md).

---

## Règle 0 — La règle qui explique toutes les autres

> **Ce qui est vrai pour le produit vit dans `packages/shared`.
> Ce qui est vrai pour l'écran vit dans l'app.**

Une couleur, un seuil, un libellé, une formule, une règle métier : **produit** → `shared`.
Un `StyleSheet`, une classe Tailwind, un navigateur, un composant : **écran** → l'app.

Test à appliquer en cas de doute : *« si je change ça d'un seul côté, est-ce que le produit
devient incohérent ? »* Si oui, ça n'a rien à faire dans l'app.

---

## 1. Les quatre surfaces partagées

| Surface | Emplacement | Ce qu'on y met | Ce qu'on n'y met **jamais** |
|---|---|---|---|
| **Tokens** | `packages/shared/src/design/` | couleurs, typo, rayons, espacements | du CSS, des `StyleSheet` |
| **Textes** | `packages/shared/src/i18n/` | catalogues `fr` / `en` | des composants, du JSX |
| **Métier** | `packages/shared/src/` | auth, booking, discovery, stats, gamification | `localStorage`, `AsyncStorage`, `window`, `Platform` |
| **Carte** | `packages/shared/src/map/` | seuils, `declump`, tiers, table `CAMERA` | Mapbox GL, `@rnmapbox` |

> **Interdit absolu dans `shared`** : `window`, `document`, `localStorage`, `AsyncStorage`,
> `Platform`, `react-native`, `mapbox-gl`. `shared` est du TypeScript pur.
> Les différences de plateforme passent par une **interface injectée** (cf. l'adaptateur
> `Storage` de la phase 3).

---

## 2. Règles d'évolution — ajouter une fonctionnalité

1. **Décider de la portée d'abord.** Web seul / mobile seul / les deux. L'écrire dans la
   description de la PR. Une portée non déclarée est traitée comme « les deux ».
2. **`shared` en premier, écrans ensuite.** Le token, le texte et la logique sont posés et
   compilent avant qu'une ligne d'UI soit écrite. Dans l'autre sens, on écrit deux fois.
3. **Un texte visible = une clé i18n**, dans `shared`, en `fr` **et** en `en`. Jamais de chaîne
   en dur dans un écran.
4. **Une valeur numérique qui pilote un comportement** (seuil de zoom, durée d'animation, palier
   de score) est une **constante nommée dans `shared`**, jamais un littéral au point d'appel.
   C'est exactement comme ça que le zoom `13` du web est devenu `9` sur mobile.
5. **Un écran web sans équivalent mobile** (ou l'inverse) doit être justifié en une phrase dans la
   PR. L'admin est web-only par décision : c'est écrit, donc ce n'est pas une dérive.

## 3. Règles de correction de bug

1. **Reproduire, puis chercher le jumeau.** Avant de corriger, vérifier si le même code existe sur
   l'autre plateforme :
   ```bash
   grep -rn "<nom-de-la-fonction>" apps/web/src apps/mobile/src
   ```
   Si le bug est dans du code dupliqué, **il est présent des deux côtés** — même s'il ne se voit
   que d'un.
2. **Corriger les deux dans la même PR.** Un correctif appliqué d'un seul côté crée une dérive
   volontaire : c'est pire que le bug, parce que plus personne ne sait quelle version est la bonne.
3. **Si le bug vient d'une duplication, supprimer la duplication.** La correction n'est pas
   « changer 9 en 13 », c'est « faire lire la même constante aux deux ». Sinon le bug revient.
4. **Un bug de cohérence est un bug.** « Le mobile n'a pas cet écran », « le texte n'est pas le
   même », « la couleur diffère » — ce sont des tickets, pas des détails.
5. **Écrire le parcours de recette** dans la PR : ce qu'on fait, ce qu'on doit voir, sur les
   **deux** plateformes.

## 4. Règles anti-incohérence

1. **Interdit de recopier.** Si un besoin existe déjà en face, on l'extrait dans `shared` et on
   l'importe. Copier-coller entre `apps/web` et `apps/mobile` est la seule chose formellement
   proscrite de ce document. `declump()` existe deux fois : c'est une dette, pas un modèle.
2. **Le web est la référence en cas de conflit.** Formulation, palette, hiérarchie visuelle : le
   web tranche, sauf décision contraire écrite. Il est plus abouti et plus exposé.
3. **Une constante partagée ne se surcharge pas localement.** Si une plateforme a besoin d'une
   valeur différente, la table partagée porte les deux variantes explicitement — elle ne se
   contourne pas au point d'appel.
4. **Toute PR qui touche une surface partagée coche la checklist de parité** (§5).
5. **Une dérive assumée s'écrit.** Une différence volontaire va dans `docs/` avec sa raison.
   Non écrite, elle sera « corrigée » par quelqu'un dans six mois — ou pire, recopiée.

---

## 5. Checklist de parité

À coller dans toute PR touchant tokens, i18n, métier ou carte.

```markdown
## Parité web ↔ mobile
- [ ] Portée déclarée : web / mobile / les deux
- [ ] Aucune valeur en dur : tout littéral de comportement est une constante `shared`
- [ ] Aucun texte en dur : toute chaîne visible a une clé i18n en `fr` ET `en`
- [ ] Aucun copier-coller entre apps : le code commun est dans `packages/shared`
- [ ] `shared` reste pur : ni `window`, ni `Platform`, ni `react-native`, ni `mapbox-gl`
- [ ] `npm run check` passe (build web + typecheck mobile)
- [ ] Testé manuellement sur les deux plateformes
- [ ] Si carte : les 6 parcours de recette d'AUDIT-CARTE.md §5 sont passés
- [ ] Toute différence volontaire est écrite et justifiée
```

---

## 6. Garde-fous automatiques

À mettre en place progressivement — l'ordre reflète le rapport effet/coût.

| # | Garde-fou | Détecte |
|---|---|---|
| 1 | Test : `fr` et `en` ont exactement le même jeu de clés | traduction oubliée |
| 2 | Lint : import interdit de `react-native`/`mapbox-gl`/`window` dans `packages/shared` | fuite de plateforme |
| 3 | Test : toute clé i18n référencée dans une app existe dans `shared` | clé morte, clé fantôme |
| 4 | Script : détection de blocs > 20 lignes identiques entre `apps/web` et `apps/mobile` | duplication naissante |
| 5 | Test : les tokens générés dans `index.css` correspondent à `shared/design/tokens.ts` | dérive de palette |

Le n°1 et le n°2 sont rapides et couvrent les deux dérives les plus fréquentes — commencer par là.

---

## 7. Commandes utiles

Vérification complète avant toute PR :

```bash
npm run check
```

Chercher un symbole des deux côtés avant de corriger :

```bash
grep -rn "goToArtist" apps/web/src apps/mobile/src
```

Comparer les jeux de clés i18n :

```bash
comm -3 <(grep -oE "'[a-z]+\.[a-zA-Z0-9]+':" apps/web/src/i18n/translations.ts | sort -u) <(grep -oE "'[a-z]+\.[a-zA-Z0-9]+':" apps/mobile/src/i18n/index.tsx | sort -u)
```

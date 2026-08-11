---
name: parite-web-mobile
description: Applique les règles de parité Musimaps entre apps/web (Vite+React) et apps/mobile (Expo+RN). À utiliser dès qu'une tâche touche une couleur, un texte i18n, une règle métier, la carte/globe, ou un écran présent des deux côtés — ainsi que pour toute correction de bug dans du code potentiellement dupliqué. Déclencheurs typiques : "corrige ce bug", "ajoute cet écran", "aligne le mobile sur le web", "change cette couleur/ce texte", "le mobile est bizarre", tout travail sur GlobeMap / ExploreScreen / PlacePanel / Dashboard / i18n / theme.ts / index.css.
---

# Parité web ↔ mobile — Musimaps

Musimaps a **deux surfaces** (`apps/web`, `apps/mobile`) et **un seul produit**. Ce skill évite de
recréer la dérive documentée dans `docs/AUDIT-CARTE.md`.

## Règle 0

> Ce qui est vrai pour le **produit** vit dans `packages/shared`.
> Ce qui est vrai pour l'**écran** vit dans l'app.

Test en cas de doute : *si je change ça d'un seul côté, le produit devient-il incohérent ?*
Si oui → `shared`.

## Avant d'écrire la moindre ligne

1. **Chercher le jumeau.** Systématiquement, avant toute modification :
   ```bash
   grep -rn "<symbole>" apps/web/src apps/mobile/src
   ```
   Beaucoup de code existe en double à l'identique (`declump`, `goToArtist`, `tierOf`,
   `clusterBy`, `PlacePanel`, tous les `lib/*.ts`). **Un bug dans ce code est présent des deux
   côtés**, même s'il ne se voit que d'un.

2. **Lire la doc concernée** avant de proposer une solution :
   - carte / globe / pins / zoom → `docs/AUDIT-CARTE.md`
   - architecture, phases, priorités → `docs/PLAN-COHERENCE-WEB-MOBILE.md`
   - règles complètes → `docs/REGLES-EVOLUTION.md`

3. **Déclarer la portée** : web / mobile / les deux. Sans déclaration → les deux.

## Pendant

- **Jamais de copier-coller** entre `apps/web` et `apps/mobile`. Le besoin commun s'extrait dans
  `packages/shared`, puis s'importe.
- **Jamais de littéral de comportement** au point d'appel. Un seuil de zoom, une durée
  d'animation, un palier de score = une constante nommée dans `shared`. C'est comme ça que le zoom
  `13` du web est devenu `9` sur mobile.
- **Jamais de chaîne visible en dur.** Clé i18n dans `shared`, en `fr` **et** en `en`.
- **`shared` reste pur.** Interdits : `window`, `document`, `localStorage`, `AsyncStorage`,
  `Platform`, `react-native`, `mapbox-gl`. Les différences de plateforme passent par une interface
  injectée.
- **Le web est la référence** en cas de conflit de formulation, de palette ou de hiérarchie
  visuelle — sauf décision contraire écrite.
- **Corriger les deux côtés dans la même passe.** Un correctif appliqué d'un seul côté crée une
  dérive volontaire : plus personne ne sait quelle version fait foi.
- **Si le bug vient d'une duplication, supprimer la duplication.** La correction n'est pas
  « changer 9 en 13 », c'est « faire lire la même constante aux deux ». Sinon le bug revient.

## Avant de conclure

```bash
npm run check
```

Puis la checklist :

- [ ] Portée déclarée
- [ ] Aucune valeur ni chaîne en dur
- [ ] Aucun copier-coller entre apps
- [ ] `shared` reste pur
- [ ] `npm run check` passe
- [ ] Différences volontaires écrites et justifiées

**Si la tâche touche la carte**, rejouer les 6 parcours de `docs/AUDIT-CARTE.md` §5 :
vue globe au repos · recherche d'artiste · recherche de lieu · clic cluster pays ·
navigation flèche-à-flèche · retour vue globe.

## Pièges connus

| Piège | Détail |
|---|---|
| Pins en haut à gauche | ne jamais créer de marker sans coordonnée valide ; ne pas mélanger `scale` et `transform` sur le même élément |
| Pins invisibles pendant la rotation | web : `jumpTo`, jamais `setCenter` (Mapbox masque les markers jusqu'au `moveend`) |
| Vol annulé | couper la rotation **avant** le `flyTo`, sinon le tick suivant écrase la caméra |
| Caméra à côté du pin | voler sur la position **dés-empilée** au zoom cible, pas sur la coordonnée brute |
| Zoom mobile désynchronisé | `ExploreScreen` a deux écrivains sur `mapZoom` (interpolation `setInterval` + `loadRegion`) |
| Clusters qui ne se scindent pas | mettre à jour le niveau sur l'événement `zoom`, pas sur `moveend` |

# Musimaps

Monorepo npm workspaces à **deux surfaces** pour **un seul produit**.

| Workspace | Stack | Rôle |
|---|---|---|
| `apps/web` | Vite 8 · React 19 · react-router-dom 7 · Tailwind v4 · shadcn/Radix · mapbox-gl | landing, globe, dashboard, admin |
| `apps/mobile` | Expo 57 · RN 0.86 · React Navigation · @rnmapbox/maps | app native iOS/Android |
| `packages/shared` | TypeScript pur | types, geo, tiers de popularité, helpers |

**Ce n'est pas du Next.js** et ce n'est pas react-native-web : les deux UI sont distinctes et le
restent. Voir `docs/PLAN-COHERENCE-WEB-MOBILE.md` pour le pourquoi.

## Commandes

```bash
npm run dev:web        # Vite
npm run dev:mobile     # Expo
npm run check          # build web + typecheck mobile — à passer avant toute PR
```

## Règle 0

> Ce qui est vrai pour le **produit** vit dans `packages/shared`.
> Ce qui est vrai pour l'**écran** vit dans l'app.

Couleur, seuil, libellé, formule, règle métier → `shared`.
`StyleSheet`, classe Tailwind, navigation, composant → l'app.

## Non négociable

- **Jamais de copier-coller entre `apps/web` et `apps/mobile`.** Le besoin commun s'extrait dans
  `packages/shared`. Du code dupliqué existe encore (`declump`, `goToArtist`, `lib/*.ts`) : c'est
  une dette identifiée, pas un modèle à suivre.
- **Jamais de littéral de comportement** au point d'appel (seuil de zoom, durée d'animation,
  palier de score) : une constante nommée dans `shared`.
- **Jamais de chaîne visible en dur** : clé i18n en `fr` **et** en `en`.
- **`shared` reste pur** : ni `window`, ni `localStorage`, ni `AsyncStorage`, ni `Platform`, ni
  `react-native`, ni `mapbox-gl`.
- **Un bug dans du code dupliqué se corrige des deux côtés dans la même passe** — et la
  duplication disparaît au passage.
- **Le web est la référence** en cas de conflit de formulation, palette ou hiérarchie visuelle.

## Avant de modifier quoi que ce soit

```bash
grep -rn "<symbole>" apps/web/src apps/mobile/src
```

Si le symbole existe des deux côtés, la modification concerne les deux.

## Documentation

| Fichier | Contenu |
|---|---|
| `docs/PLAN-COHERENCE-WEB-MOBILE.md` | état des lieux chiffré + plan de convergence en 6 phases |
| `docs/AUDIT-CARTE.md` | audit carte/globe web↔mobile, corrections, 6 parcours de recette |
| `docs/REGLES-EVOLUTION.md` | règles complètes, checklist de parité, garde-fous |
| `docs/PROJECT-STATE.md` · `docs/FEATURES-ROADMAP.md` | état produit et feuille de route |

Le skill `parite-web-mobile` (`.claude/skills/`) applique ces règles automatiquement sur toute
tâche cross-plateforme.

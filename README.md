# Musimaps monorepo

Deux clients, une seule source métier et un seul backend Supabase.

```text
musimaps/
├─ apps/
│  ├─ web/                  # React + Vite + Mapbox
│  └─ mobile/               # React Native + Expo
├─ packages/
│  └─ shared/               # Types, artistes, villes et recherche
├─ supabase/
│  └─ migrations/           # Schéma commun aux deux applications
└─ design/
   ├─ concepts/             # Concepts HTML historiques
   └─ figma/                # Source Figma et exports de référence
```

## Installation

```bash
npm install
```

## Commandes

```bash
npm run dev:web
npm run dev:mobile
npm run build:web
npm run build:mobile:android
npm run build:mobile:ios
npm run check
```

## Responsabilités

- `apps/web` contient uniquement les préoccupations navigateur et Mapbox.
- `apps/mobile` contient uniquement les préoccupations Expo et natives.
- `packages/shared` ne dépend d’aucun framework et constitue la source unique du catalogue.
- `supabase` appartient au produit entier, pas à une application particulière.
- chaque application conserve son propre `.env.local`, car les préfixes publics diffèrent :
  `VITE_*` pour le web et `EXPO_PUBLIC_*` pour Expo.

## Documentation

- [`docs/PROJECT-STATE.md`](docs/PROJECT-STATE.md) — état complet : architecture, données, scripts, déploiement, accès.
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — historique des évolutions, features et fix.

# Musimaps Mobile

Prototype React Native + Expo inspiré des maquettes Figma du dossier `Mobile App` et de la carte de l’application web.

## Fonctionnalités

- onboarding avec demande de géolocalisation ou sélection manuelle d’une ville ;
- carte native interactive avec marqueurs d’artistes ;
- recherche par ville, pays, artiste ou genre ;
- fiche artiste avec onglets, lecture simulée, partage et favoris ;
- collection locale utilisable hors connexion ;
- profil local modifiable et favoris persistants sur l’appareil ;
- thème clair/sombre persistant ;
- splash natif et écran d’entrée fidèle à l’export Figma ;
- profil utilisateur et demande de référencement artiste ;
- même table `waitlist` et même projet Supabase que l’application web.

## Démarrage

```bash
npm install
npm run sync:env
npm start
```

Scanne ensuite le QR code avec Expo Go, ou lance :

```bash
npm run android
npm run ios
```

`npm run sync:env` copie uniquement les variables publiques Supabase de
`../web/.env.local` vers le `.env.local` mobile.

## Supabase

La demande artiste fonctionne immédiatement avec la table `waitlist` existante.

Pour activer la synchronisation distante des favoris et des profils, applique la migration :

`../../supabase/migrations/00002_mobile_profiles_favorites.sql`

Sans cette migration, les favoris restent entièrement fonctionnels et persistants localement via AsyncStorage.

## Vérifications

```bash
npm run typecheck
npx expo-doctor
npx expo export --platform android
npx expo export --platform ios
```

# Profils et couvertures — correction et APK du 9 septembre 2026

## Implémentation

Le skill de parité web/mobile a guidé l’extraction du contrat visuel dans
`packages/shared/src/design/profile-media.ts`, sans dupliquer les constantes produit.
Les composants de présentation restent propres à chaque app (`AccountMedia.tsx`).

- Le dashboard web affiche désormais la couverture du **compte**, distincte du profil artiste.
- Profil : avatar rond de 112, bordure thémée de 4, chevauchement de 56 sur la couverture.
- Éditeur : avatar rond de 80, sous la couverture sur les deux surfaces, boutons média de 44.
- Couverture : cadrage centré, ratio nominal 16:9, hauteur bornée entre 144 et 208.
- Images indisponibles : mêmes initiales et dégradés de remplacement, sans image cassée.
- Mobile : recharge exacte des URLs de session, y compris leur suppression, et texte du
  profil connecté aligné sur le web. Le texte « sur cet appareil » est réservé aux invités.
- Le contrôle natif a révélé que Yoga réduisait la largeur avec `aspectRatio` + `maxHeight`.
  La hauteur est maintenant calculée depuis la largeur mesurée, sans réduire cette largeur.

## Vérification

- `npm run check` : PASS, dont 144 tests unitaires, contrôles i18n/design/contraste,
  suites métier existantes, compilation web et contrôle TypeScript mobile.
- `EXPO_QA_URL=http://localhost:8081 npx playwright test e2e/profile-media.spec.ts --workers=1` :
  **8/8 PASS** (web/Expo Web × viewport ordinateur/téléphone × français-clair/anglais-sombre).
- Les parcours ouvrent le profil, l’éditeur, contrôlent dimensions/chevauchement/largeur,
  puis rejouent avec des URLs d’images indisponibles. Données synthétiques interceptées ;
  aucune mutation réelle de compte ni upload réel durant ces tests navigateur.
- Captures inspectées sur les deux surfaces. Deux captures Expo Web finales : 2/2 PASS.
  Certaines captures web optionnelles ont attendu indéfiniment les polices distantes ;
  les captures disponibles ont été inspectées et le test fonctionnel séparé passe.
- APK reconstruit après la correction native, installé avec conservation des données.
  Démarrage, profil et éditeur contrôlés visuellement dans l’émulateur Android ; la bande
  vide à droite de la couverture a disparu dans les deux écrans.
- Signature APK valide, alignement ZIP des bibliothèques natives à 16 Ko valide.

## Artefact de test

- `output/apk/musimaps-android-test-2026-09-09.apk` — environ 29 Mo, ARM64.
- Package `com.musimaps.app`, version `1.0.0`, versionCode `1`, min API 24, cible API 36.
- SHA-256 : `4294e37a8cb8dfe430b836db903ae536cb16ffde0627d537387a0e1e2317b77f`.
- Build local `assembleRelease`, JS embarqué, signature de test Android Debug.
  **Pas un livrable signé pour publication Play Store.** Aucun envoi au Store.
- Inclut l’état de travail mobile et partagé actuel, non limité aux seuls changements committés.
  Les modifications de l’admin/web nécessitent toujours un déploiement web séparé.

## Migration confirmée et limites de recette

Le premier contrôle Supabase en lecture seule (`select cover_url`, limite zéro, aucun profil lu)
avait confirmé que la colonne distante manquait. L’utilisateur a ensuite exécuté dans le SQL Editor :

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text;
```

Ce SQL est déjà versionnable dans `supabase/migrations/00063_profile_cover.sql`.
Après sa confirmation, une nouvelle lecture distante a retourné **HTTP 200** : la colonne
`profiles.cover_url` est désormais accessible. L’agent n’a effectué aucune écriture distante.
L’APK existant contient déjà le support de ce champ : aucune recompilation n’est nécessaire
pour cette migration. La **présentation** des couvertures est vérifiée ; l’import/recadrage
réel de photos et leur synchronisation doivent encore être testés sur un compte de test
et un appareil Android physique. Le contrôle de schéma seul ne valide pas ces écritures.

Captures locales : `output/qa/profile-media/`. Aucun compte supprimé, aucune photo réelle modifiée,
aucune permission de localisation changée, aucun contenu CMS publié pendant cette passe.

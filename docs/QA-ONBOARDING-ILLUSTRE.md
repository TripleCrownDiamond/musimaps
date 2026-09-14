# Onboarding illustré — 8 septembre 2026

## Portée et rendu

Application Expo native et prévisualisation Expo Web. Le site Vite n’a pas de
carrousel d’introduction équivalent ; son admin conserve l’édition des textes
et accepte une illustration de remplacement par langue. Aucun contenu CMS
n’a été publié pendant cette intervention.

Les quatre **dernières** images fournies par l’utilisateur sont embarquées,
sans retouche ni découpe, dans `packages/shared/assets/onboarding/` :

| Étape | Image fournie | Asset |
| --- | --- | --- |
| Globe | 4 | `globe.png` |
| Recherche | 1 | `search.png` |
| Favoris | 2 | `favorites.png` |
| Récompenses | 3 | `rewards.png` |

PNG transparents 1254 × 1254, affichés intégralement avec `contain`. Les
premiers essais de retouche automatique, au fond opaque, ne sont pas utilisés.
Le mécanisme provisoire de masquage des anciens cartouches a été supprimé.

La pilule avec point bleu, le titre gras bicolore et la description sont de
vrais composants. Les libellés viennent des catalogues FR/EN ou du CMS publié.
Le fond du cartouche, le texte et les bordures suivent le thème global ;
l’accent bleu du titre est éclairci en sombre pour rester lisible.

Les visuels fonctionnent hors ligne. Une URL CMS HTTPS optionnelle peut les
remplacer ; un échec de chargement rétablit l’illustration embarquée. Les
anciens contenus CMS restent compatibles. Une réponse tardive ne réordonne
pas le parcours en cours et un changement de langue ne conserve pas les
textes CMS de la langue précédente.

## Vérifications

- TypeScript mobile, build web et APK Android ARM : réussis.
- 132 tests unitaires réussis, dont quatre pour la sélection des visuels,
  la compatibilité CMS et les accents de titres traduits.
- Catalogues i18n : 911 clés synchronisées FR/EN ; `git diff --check` passe.
- Parcours Expo Web : quatre étapes en français clair (390 × 844), anglais
  sombre (390 × 844), français sombre (320 × 568). Images chargées, titres
  traduits, CTA dans l’écran, pagination et fin du parcours vérifiés.
- Les étapes non actives sont masquées aux technologies d’assistance.
- Le bouton Continuer a également été exercé dans le navigateur visible.
- L’APK mis à jour est installé dans l’émulateur sans effacement des données.
- Android natif : première étape contrôlée visuellement en anglais clair,
  puis Continuer ouvre « Find your next discovery » et sélectionne l’étape 2.

Accès direct pour rejouer la présentation : `/onboarding` sur Expo Web,
`musimaps://onboarding` en natif. La mémorisation du premier lancement reste
inchangée ; ouvrir ce lien ne remet pas à zéro les données de l’utilisateur.

## Limites

`npm run check` reste arrêté par un plafond de styles préexistant : 31 rayons
distincts pour 29 autorisés. Les espacements sont revenus au plafond autorisé
(35/35), les couleurs restent sous le plafond (20/24). Pas de déploiement de
production, pas de test sur appareil iOS physique dans cette passe.

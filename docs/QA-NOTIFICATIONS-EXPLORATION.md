# Notifications et contexte d’exploration — 8 septembre 2026

Portée : web Vite et application Expo native Android. Aucun déploiement de
production, aucune modification des permissions macOS, aucun compte créé.

## Corrections

- Notifications Android réutilise `AppBar`, sous l’inset système, au même
  niveau que Découvrir. Le titre est sous la barre pour laisser les actions
  utilisables sur un écran étroit.
- « Tout lire » précède la cloche sur les deux interfaces. L’action est
  désactivée sans non-lus ou pendant le traitement. Le compteur de la page
  alimente la cloche de cet en-tête.
- Le panneau de recherche présente une croix à droite sur les deux surfaces,
  sans cloche dans le panneau.
- Le retour système Android ferme d’abord la recherche ou la fiche artiste.
- Le contexte partagé distingue destination explorée et position GPS.
  Fermer une fiche ne déclenche ni localisation ni vol vers l’appareil.

## Vérifications réalisées

- Émulateur Android ARM : boutons Notifications et cloche Découvrir mesurés
  aux mêmes bornes verticales (207–339 px physiques). Retour testé au premier
  appui. État vide et action de lecture désactivée vérifiés.
- Recherche : croix présente sur Android et web ; retour système Android
  testé après correction, l’application reste au premier plan.
- Découverte aléatoire web : KiDi à Accra, puis fermeture ; le contexte
  « Vous découvrez » et les pins voisins sont conservés.
- Découverte aléatoire Android depuis Découvrir : Howard Carpendale ;
  fermeture et observation différée sans retour au GPS de test au Bénin.
- Recherche d’artiste : Omah Lay sur web, Ayra Starr sur Android. Le libellé
  décrit la destination explorée. Sur Android, un aller-retour Découvrir →
  Carte après fermeture conserve Lagos sans rouvrir la fiche.
- Recherche de lieu web : Lagos, arrivée sur Ayra Starr et navigation vers
  Chigul. Clic pays Mali et flèches également exercés.
- Recherche de lieu Android : Lagos ouvre Ayra Starr (1/8), avec le libellé
  « You are exploring · Lagos, Nigeria » et le panneau de navigation local.
- Android : un seul appui sur l’étincelle du Mali ouvre Toumani Diabaté
  (1/5) ; la flèche suivante cible Ali Farka Touré (2/5).
- Retour vue globe exercé sur les deux surfaces : réapparition des contrôles
  Play et localisation. Aucune mesure de fréquence d’images n’est revendiquée.
- Recentrage explicite Android après exploration de Lagos : retour au GPS de
  test à Houenoussou, Godomey, Bénin. L’en-tête repasse à « You are here »,
  le point de position reste sans cartouche et les contrôles Play/recentrage
  sont masqués dans la vue rapprochée.

## Contrôles automatiques et limites

- 128 tests unitaires, 21 tests carte, 3 tests Notifications passent.
- TypeScript mobile, compilation web et APK Android ARM passent.
- Contraste, géoréparation, déplacement administrateur des pins, position de
  liste d’attente et balises Open Graph passent.
- `npm run check` reste arrêté par les plafonds de styles déjà dépassés avant
  cette passe : 31 rayons distincts pour 29 autorisés, 36 espacements pour 35.
- Notifications web connecté, lecture de véritables notifications non lues,
  iOS natif et téléphone Android physique non testés dans cette passe.
- Anomalie de données observée, non corrigée ici : la fiche de Howard
  Carpendale associe « Durban » au code pays « DE ». La séparation entre
  exploration et GPS ne corrige pas le contenu géographique du catalogue.

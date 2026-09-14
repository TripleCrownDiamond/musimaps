# Flèches après Découvrir — 9 septembre 2026

## Correction web et mobile

La fermeture d’une fiche issue de Découvrir conservait les pins, mais ne créait
pas `selectedPlace`. Le panneau précédent/suivant ne pouvait donc pas apparaître.

Les deux écrans utilisent maintenant `explorationAfterArtistClose` dans shared :

- conserve le parcours et l’index si l’artiste appartient déjà au lieu actif ;
- sinon crée un parcours avec l’artiste découvert et ses voisins dans le rayon
  partagé de découverte, sans ajouter les artistes proches du GPS de l’appareil ;
- ne déplace pas la caméra et ne change pas la position de l’appareil ;
- partage également le type `MapPlace` entre les deux panneaux.

## Vérifications

- 136 tests unitaires : OK, dont 4 régressions du nouveau parcours.
- 22 tests de garde de la carte : OK, dont la fermeture sans déplacement caméra.
- TypeScript mobile, compilation web et APK release ARM64 : OK.
- APK installé avec conservation des données dans `emulator-5554`.
- `npm run check` : tokens et i18n OK ; arrêté sur le budget de rayons existant
  (31 / 29). Aucun style n’a été ajouté par ce correctif.

### Parcours demandé

- Expo Web : avant correction, aucune flèche ; après, précédent/suivant présents.
  Catalogue chargé : G-Live 1/16 → Siboy 2/16 → G-Live 1/16.
- Web Vite : Découverte aléatoire → fermer → Maphya 1/6 → Bra Myk 2/6 →
  Maphya 1/6. Réouverture/fermeture également testée avec conservation d’index.
- Android natif : filtre Lagos dans Découvrir → artiste aléatoire Asake → fermer
  → Asake 1/8 → Chigul 2/8 → rouvrir/fermer Chigul → toujours 2/8 → précédent
  → Asake 1/8. L’en-tête reste « You are exploring — Lagos, NG », pas le GPS
  de test à Godomey.

### Recette carte complémentaire

| Parcours | Web Vite | Android natif |
|---|---|---|
| Vue globe | Contrôles et retour des clusters vérifiés ; pas de mesure FPS | Contrôles et petits points visibles ; pas de mesure FPS |
| Recherche artiste | Asake, fermeture → Lagos 1/8 | Asake, fermeture → Lagos 1/8 |
| Recherche lieu | Lagos → Ayra Starr 1/8 | Lagos, sélection de la ville testée |
| Cluster pays | Tenté : Nigeria recouvert par l’étiquette Côte d’Ivoire ; Sénégal non disponible au second essai | Sénégal → Manu Lima 1/6 en un clic |
| Flèches | Suivant/précédent et réouverture de fiche vérifiés | Suivant/précédent et réouverture de fiche vérifiés |
| Retour globe | Barre locale masquée | Barre locale masquée, Play et recentrage reviennent |

Limites hors de cette correction : le chevauchement de certaines étiquettes de
pays web gêne encore le clic automatisé ; des données publiées associent parfois
un pays incohérent à une ville (par exemple Brazzaville / FR). Aucun changement
de données en production n’a été effectué. La fluidité tactile et les FPS n’ont
pas été requalifiés par cette recette ciblée sur les flèches.

# Décisions produit

> Décisions prises explicitement, à ne pas re-arbitrer sans nouvelle décision.
> Le code qui en dépend renvoie ici.

---

## Vie privée des artistes — localisation volontairement imprécise

**La carte ne situe jamais un artiste précisément.** C'est une contrainte de
protection de la vie privée, pas un réglage d'interface.

Les coordonnées sont des géocodages de **ville**, auxquels `declump` ajoute une
spirale de ~1 à 2 km. Zoomer au-delà du quartier afficherait :

- une précision **fausse** pour la plupart des artistes — le pin ne correspond
  à aucune adresse réelle ;
- une précision **réelle et non souhaitée** pour ceux dont la coordonnée serait
  fine : on exposerait leur domicile.

**Conséquences dans le code**, toutes dans `packages/shared/src/map/index.ts` :

1. `MAX_ZOOM = 15` — niveau quartier, granularité du champ `district`.
   Valait 18, le niveau rue. Ne pas la remonter.
2. `MAX_OFFSET_KM = 1.5` — borne de **véracité** du dés-empilement. Au-delà,
   on n'écarte plus des pins, on invente une localisation.
3. `SPREAD_ZOOM = 11` — en dessous, les artistes restent groupés.

Le dés-empilement part de la séparation ÉCRAN voulue (46 px) et en déduit le
rayon géographique. L'ancienne formule faisait l'inverse — le rayon croissait
avec le zoom, alors que le zoom double déjà la séparation en pixels. Mesuré :
9 px de séparation à z9 (pins empilés) et 995 px à z15, avec un pin posé à
**2,4 km** de la vraie position. Désormais la séparation reste constante
(46 → 122 px) et le décalage réel diminue quand on s'approche : 1,5 km à z11,
291 m à z15.

À vérifier lors de tout travail sur la carte : aucun chemin ne doit permettre
de dépasser `MAX_ZOOM`, et aucune vue ne doit afficher une adresse.

---

## Identité visuelle du globe — bleu dominant, lime en accent

Les trois rendus du globe — carte web principale, preview de la landing et
carte mobile — suivent **la même recette** dans
`packages/shared/src/map/style.ts`. Une plateforme ne redéfinit jamais sa
palette localement.

- **Bleu principal `#2F52E0`** : eau, halo atmosphérique et frontières. Le
  globe doit être immédiatement identifiable comme Musimaps.
- **Lime secondaire `#A8FF35`** : végétation, parcs, reliefs doux et labels
  majeurs sur fond sombre. Le lime reste un accent, jamais la masse dominante.
- **Terres sobres et teintées** : fond clair chaud en thème clair, bleu nuit en
  thème sombre, pour préserver la lisibilité des pins.
- **Pins** : leur couleur continue d'exprimer la notoriété ; la sélection la
  plus forte reste lime. La palette du fond ne doit pas concurrencer leur halo.
- **Géométrie commune** : pin artiste de base 36 px ; disque/pilule de cluster
  de 68 px minimum avec rayon 17 px ; sous-cluster de 44 px minimum. Ces
  dimensions viennent de `mapUi` dans les tokens partagés.
- **Navigation pin-à-pin** : pill noir translucide, boutons circulaires de
  36 px, nom courant sur une ligne indépendante du disque. Le nom sélectionné
  doit rester lisible jusqu'à 200 px et passer au-dessus des pins voisins.

Les couleurs sémantiques vivent dans `packages/shared/src/design/tokens.ts` ;
le module carte ne contient aucune copie des hex de marque. Le web applique la
recette aux couches Mapbox chargées, le mobile applique les mêmes actions au
`styleJSON`. Le document porte aussi le fog à sa racine : cette voie est
obligatoire pour Expo Web, dont l'adaptateur Mapbox n'expose pas le composant
natif `Atmosphere` et ne relit pas dynamiquement `styleJSON`.

La zone tactile d'un pin peut être plus grande que son disque, mais elle ne
pilote jamais sa géométrie visible. Anneau et halo restent des cercles centrés
sur le diamètre réel du pin ; ils ne s'étirent pas sur la zone de toucher.

---

## Lisibilité de la carte — le rapport prime sur la couleur

La carte claire avait dérivé vers une feuille blanche. Mesuré :

| Paire | Avant | Après |
|---|---|---|
| terre / eau | 1,20:1 | **1,77:1** |
| terre / espace | 1,06:1 | **1,24:1** |
| anneau lime (tier 3) sur la terre | 1,16:1 | inchangé — voir ci-dessous |

Deux enseignements, tous deux contre-intuitifs :

1. **Assombrir la terre ne sauve pas le pin lime.** Le lime `#A8FF35` a une
   luminance élevée : il suit la terre à mesure qu'on la fonce. Le candidat le
   plus contrasté mesurait même 1,05:1, soit un peu pire que 1,16. Les
   artistes les plus populaires — ceux que la carte existe pour montrer —
   étaient les seuls invisibles.
2. **La réponse est un liseré, pas une couleur.** `mapOverlays.pinCasing`
   pose un cercle fin qui s'oppose au FOND, pas au pin : sombre en thème
   clair, clair en thème sombre. Le tier 3 passe alors à **4,60:1** sans que
   sa couleur change — or elle porte du sens et vient de la marque.

Le liseré corrige aussi le thème sombre au passage : le bleu profond du tier 2
y mesurait 2,00:1 et passe à 18,88:1.

**Conséquences dans le code** :

- Web : `box-shadow: 0 0 0 1px var(--map-pin-casing)` sur `.artist-pin` et sur
  son `::before`. Aucun élément ajouté.
- Mobile : React Native n'a pas d'`outline` — une vue `popRingCasing` est
  posée juste en dehors de l'anneau, et `ArtistAvatar` reçoit `casing`. Sa
  bordure était blanche en dur, ce qui la rendait invisible sur la terre
  claire ; le blanc reste le défaut hors carte.
- `npm run contrast:check` fixe des **planchers** qui ne doivent que monter.
  Une couleur prise isolément est toujours valide : c'est son rapport aux
  autres qui casse, et un rapport ne se relit pas dans un diff.

⚠️ **Reste à traiter** : le thème sombre a le même défaut de séparation que le
clair avant correction — terre/eau **1,36:1**, terre/parcs **1,44:1**. Le
plancher le consigne pour qu'on ne l'aggrave pas ; ce n'est pas une cible.

---

## Paliers de compte

`account_type` admet trois valeurs en base (`CHECK`, migration 00029) :
`personal`, `business`, `premium`.

⚠️ **À ce jour, `premium` ne débloque rien dans le code.** Les deux plateformes
réservent le booking à `business` ; `premium` n'ouvre aucune fonctionnalité.
Ce qui suit est la cible, pas l'état actuel.

### Visiteur sans compte

**Peut** : voir la carte, chercher, consulter les fiches artistes,
**et sauvegarder des favoris localement** (sur l'appareil).

**Ne peut pas** : suivre, aimer, réserver, découverte aléatoire.

Les favoris locaux doivent être **migrés vers le compte à l'inscription** —
ce qui suppose de régler d'abord la non-synchronisation des favoris
(web = table Supabase `favorites`, mobile = `AsyncStorage`).
Voir [PLAN-COHERENCE-WEB-MOBILE.md](PLAN-COHERENCE-WEB-MOBILE.md).

### Mélomane connecté (gratuit)

Tout ce qui précède, plus : suivre, aimer, sauvegarder sur son compte,
réserver, gamification et badges.

Pas de limite de nombre de follows ou de likes — cette piste a été
explicitement écartée.

### Mélomane premium

Le gratuit, plus :

1. **Découverte aléatoire et suggestions** — le bouton « au hasard » et les
   recommandations d'artistes similaires.
2. **Statistiques et historique enrichis** — historique de découvertes complet,
   carte des villes visitées, badges exclusifs. S'appuie sur la gamification
   unifiée.
3. **Notifications avancées** — alertes quand un artiste suivi publie ou passe
   à proximité. La migration 00029 mentionne déjà premium pour les notifications.

### Business

Réservation d'artistes (déjà en place, des deux côtés).

---

## Ordre de travail retenu

1. **Cohérence visuelle** — panneaux de recherche, animations, standardisation
   des écrans entre web et mobile. Sans nouvelle fonctionnalité.
2. Contrôle d'accès (anonyme / connecté / premium / business / artiste).
3. Flux artiste → MusicBrainz → revendication avec informations complémentaires.
4. Abonnements et formules alignées sur les niveaux de gamification.

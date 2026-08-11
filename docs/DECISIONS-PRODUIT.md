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

**Conséquence dans le code** : `MAX_ZOOM = 15` dans
`packages/shared/src/map/index.ts` (niveau quartier, granularité du champ
`district`). Elle valait 18 — le niveau rue. Ne pas la remonter.

À vérifier lors de tout travail sur la carte : aucun chemin ne doit permettre
de dépasser ce zoom, et aucune vue ne doit afficher une adresse.

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

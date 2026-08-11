# Musimaps — Modèle de monétisation

Services payants par profil : **artistes**, **comptes business**, **mélomanes**.
Les prix sont des fourchettes indicatives — à affiner selon la zone (Afrique,
Europe, Amériques) et les coûts réels (paiements, hébergement).

---

## 1. Principes généraux

- **La carte, la recherche et la fiche artiste restent gratuites** (pas de
  mur d'abonnement sur la découverte — c'est le cœur du produit).
- 3 profils de compte : `personal` (mélomane), `business` (organisateur),
  `artist` (rôle, séparable du type de compte payant).
- Un même compte peut être **artiste + premium** ou **business + premium**.
- Paiement : Stripe (web + mobile via `react-native-stripe`), ou prélèvement
  manuel + facture pour les premiers clients business en Afrique de l'Ouest
  (beaucoup de comptes sans carte bancaire internationale) → **paiement
  mobile money (MTN MoMo, Orange Money) en v1.5**.

---

## 2. Services payants pour les ARTISTES

### Offre Découverte (gratuite, actuelle)
- Profil sur la carte, bio, liens 1 plateforme + 1 réseau, revendication.

### Premium Artiste — ~5 €/mois ou 50 €/an
| Service | Détail |
|---|---|
| **Liens illimités** | Toutes les plateformes (Spotify, Apple Music, Deezer, YouTube, Bandcamp, SoundCloud…) + tous les réseaux (Instagram, TikTok, X, Facebook) |
| **Épinglage / mise en avant** | Pin plus gros + bouton « En tournée » animé (ring lime) |
| **Stats avancées** | Vues uniques par pays, 14 jours, likes, top visiteurs récurrents — le dashboard devient leur outil de promo |
| **Page d'accueil premium** | Section « Artistes premium » sur la landing + vitrine |
| **Priorité recherche** | Meilleur rang dans les résultats de recherche (artiste/ville/genre) |

### Premium Artiste Pro — ~15 €/mois
Tout Premium + :
- **Badge vérifié** (pastille bleue/lime à côté du nom) ;
- **Bio longue** (5 000 caractères, photos en carrousel) ;
- **Événements illimités** (concerts, tournées — affichés sur la carte avec
  animation « en concert ») ;
- **Export de stats** (PDF/CSV pour les dossiers de presse) ;
- **Priorité support** (réponse < 48 h).

### Mise en avant ponctuelle (à la carte)
- **Boost de découverte** : 1 semaine de visibilité en tête des résultats
  dans une ville — 10–20 €/semaine selon la ville.
- **Concerts sponsorisés** : événement épinglé en haut de la section
  Événements — 5–15 €/événement.

---

## 3. Services payants pour les comptes BUSINESS

### Business (déjà en place : réservation)
- Le compte `business` peut envoyer des **demandes de réservation** aux
  artistes (type d'événement, budget, date, public attendu).

### Business Pro — ~30 €/mois
| Service | Détail |
|---|---|
| **Réservations illimitées** | Plus de limite mensuelle (10/mois en gratuit business) |
| **Annuaire des artistes** | Filtres avancés (genre, ville, prix, dispo), export CSV des profils |
| **Multipostes** | Plusieurs organisateurs (équipe) sur un même compte |
| **Tableau de bord** | Stats de mes demandes : taux de réponse, délais, taux de confirmation par artiste/ville |
| **Mise en avant des annonces** | Les demandes « urgentes » remontent chez les artistes |

### Business Entreprise — sur devis
- API de réservation (intégration billetterie : Ticketea, Weezevent…),
  gestionnaire de compte dédié, facturation, NDA.

---

## 4. Services payants pour les MÉLOMANES

### Gratuit (actuel)
- Explorer la carte, rechercher, suivre/liker, playlists de favoris, streak,
  badges, notifications de découverte.

### Musimaps+ — ~3 €/mois ou 25 €/an
| Service | Détail |
|---|---|
| **Limites levées** | Suivre un nombre illimité d'artistes (50 en gratuit), likes illimités (200 en gratuit) |
| **Notifications prioritaires** | Concerts et sorties des artistes suivis en premier, alertes immédiates |
| **Badge de profil** | Pastille « + » sur son profil public |
| **Découverte intelligente** | Recommandations par ville/genre/artistes suivis plus précises |
| **Accès anticipé** | Nouvelles fonctionnalités (bêta) |

### Pour les super fans — 6 €/mois
Tout Musimaps+ + :
- **Soutien direct** : 80 % du montant redistribué aux artistes qu'ils suivent
  (micro-dons mensuels répartis) — argument social fort ;
- **Contenu exclusif** des artistes partenaires (photos, messages privés de
  groupe) ;
- **Accès aux préventes** annoncées sur le mur des artistes.

---

## 5. Modèle de revenus récapitulatif

| Flux | Acteur payant | Fourchette |
|---|---|---|
| Premium Artiste | Artistes | 5 €/mois |
| Premium Artiste Pro | Artistes | 15 €/mois |
| Boost / sponsoring | Artistes | 10–20 €/semaine |
| Business Pro | Organisateurs | 30 €/mois |
| Business Entreprise | Structures | devis |
| Musimaps+ | Mélomanes | 3 €/mois |
| Super fan | Mélomanes | 6 €/mois |
| **Commission booking** (v1.5) | Business | 5 % de chaque réservation confirmée |

Le **booking** est le levier le plus rentable à terme : commission de 5 %
sur les réservations confirmées (avec plancher de 10 €). L'artiste gagne de
la visibilité, le business un réseau vérifié, Musimaps une commission — tout
le monde y gagne.

---

## 6. Point d'attention juridique

- **Statut des paiements** : selon la zone, TVA (UE) ou pas (Côte d'Ivoire,
  Bénin…). Faire valider le modèle par un juriste avant de facturer.
- **Redistribution super fan** : cadrer (dons vs abonnement) pour éviter la
  qualification de « don déguisé ».
- **CGU** : distinction claire entre services gratuits et payants, droit de
  rétractation.

---

## 7. Priorité d'implémentation suggérée

1. **Premium Artiste (liens illimités + épinglage + stats)** — le plus simple,
   génère le plus de valeur perçue immédiate. Le socle existe déjà (colonnes
   `account_type`, gamification, dashboard stats).
2. **Musimaps+ (limites levées + notifications)** — léger, volume important.
3. **Business Pro** — dépend du booking déjà en place.
4. **Super fan / redistribution** — après validation juridique.
5. **Commission booking** — après volume suffisant.

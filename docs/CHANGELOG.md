# Musimaps — Changelog des évolutions

> Historique complet des évolutions, des fix et des choix faits au fil du développement.
> Le plus récent est en tête. Les migrations listées sont celles appliquées en production
> sauf mention contraire.

---

## Août 2026 — Session récente (résumé)

### 10 août — District / quartier, frontières brand, pays géographique, pins lumineux

**Quartier / district sur toute la chaîne**
- Migration `00056_artist_district.sql` : colonne `district` sur `map_artists` + `waitlist` ; RPC
  `add_or_update_map_artist` enrichi (INSERT + UPDATE COALESCE). Appliquée en prod.
- Champ « Quartier / district » dans : page `/artistes` (web), « Modifier le profil » (web + mobile),
  `ArtistJoinScreen` (mobile), admin « Artistes découverts » (modale d'édition) et liste d'attente.
- `district` propagé dans les types partagés (`Artist.district?`), les profils de compte
  (`UserProfile.district`, sync mobile ↔ web via `profiles`), la conversion waitlist → carte.
- **Géocodage par quartier** : `geocodeArtistLocation(city, country, district)` + `locateArtist`
  géocode « quartier, ville, pays » → le pin atterrit dans le vrai quartier ; deux artistes d'une
  même ville mais de quartiers différents ne s'empilent plus au centre-ville.
- L'admin re-géocode automatiquement quand un quartier est saisi/corrigé.
- Affichage « Quartier, Ville, Pays » sur la fiche artiste et la page profil (web + mobile).
- Conversion waitlist : le pays est résolu par Mapbox quand l'entrée n'en déclare pas (parité avec le
  chemin sans quartier).

**Carte aux couleurs de la marque**
- Frontières des pays (`admin-0-boundary`) teintées **bleu brand** `rgba(47,82,224,…)` (75 % sombre /
  50 % clair) — la carte reste monochrome, seuls les tracés portent l'identité.
- Web : `setPaintProperty` au `style.load`. Mobile : fetch du style Mapbox, teinte, passage en
  `styleJSON` (repli silencieux vers le style URL si le fetch échoue).

**Pays GÉOGRAPHIQUE (fix du cluster fantôme)**
- **Bug** : en zoomant sur l'Afrique du Sud, la mini-barre affichait « États-Unis ». Cause : `country`
  stockait le pays d'ORIGINE (MusicBrainz) — « Gary Barber | Johannesburg | US » → cluster « US »
  fantôme posé au-dessus de la ZA.
- `locateArtist` (web + mobile) : le pays résolu par le géocodage **prime** désormais sur le pays déclaré.
- `scripts/fix-geo-country.mjs` (nouveau) : reverse-géocodage Mapbox de tous les pins ; si le pays réel
  diffère du déclaré et que la ville existe dans le pays géo → corrige le pays ; si la ville n'existe
  que dans le pays déclaré (homonymie, ex. Kano) → corrige les coordonnées. **46 pays corrigés en prod.**

**Pins lumineux colorés par densité** *(code sur disque — finalisation en cours)*
- Pins individuels : fond + halo lumineux dans la couleur du **tier de popularité**
  (gris neutre → bleu brand → bleu profond → lime), encre contrastée (blanche / sombre sur lime).
- Clusters pays/ville/sous-groupes : même colorimétrie (tier max du groupe), halo lumineux, points
  globe teintés.
- Mobile : halo coloré par tier, fond/bordure des clusters par tier, encre adaptée (parité web).

### 9 août — Mini-barre lieu, flèches, rotation mobile

- **Mini-barre « lieu »** (PlacePanel) au-dessus des boutons Vue Globe / Play : petit pill translucide
  `‹ 🇫🇷 France 23 artistes ›` avec flèches précédent/suivant pour sauter d'artiste en artiste — le pin
  sélectionné se déplace sur la carte (globe view). Retiré le gros panneau de stats.
- **Atterrissage toujours sur un pin** : clic cluster → vol vers le PREMIER artiste à sa position
  **dés-empilée** (spirale recalculée au zoom cible 13), jamais le barycentre dans le vide ; le pin est
  mis en évidence (`highlightedId`).
- **Flèches** : `focusArtist(id)` (web) / `jumpPlaceArtist` (mobile) volent vers la position RÉELLEMENT
  affichée (déclump) → le pin arrive au centre de l'écran.
- **Rotation mobile réparable à la main** : le tick utilisait `flyTo` (animation native qui bloque les
  gestes) → passage à `moveTo` (saut instantané, parité web `jumpTo`) ; l'intervalle est stocké dans une
  ref et coupé **synchronement** au contact (`onTouchStart`, `onRegionIsChanging`, `isGestureActive`).
- Points de cluster en vue globe : petits (19 px) et discrets, ils grossissent au zoom (même courbe
  d'échelle que le web).

### 8 août — Recherche & gating Musibrainz, données

- Recherche multi-sources (MusicBrainz → Wikipedia → Wikidata → agent IA) avec vérification des
  non-musiciens ; **gating** : un utilisateur non-artiste ne voit que l'existant, sans bouton d'ajout.
- « Demander le référencement » quand l'artiste n'a pas de localisation (autre bouton, infos complétées,
  l'admin valide).
- Reset de la base + peuplement ciblé (artistes populaires avec infos/images) ; clusters pays avec
  code + compteur + fans en notation compacte (`10 K`, `1,2 M`).
- Zoom profond autorisé (niveau quartier/rue, `maxZoom 18`), pins détachés.

### Semaines précédentes (résumé par thème)

**Admin & CMS**
- Pages admin : Vue d'ensemble (stats + graphiques SVG maison : barres, donuts, courbes), Artistes
  découverts (filtres statut compte+carte / carte seule, édition complète liens/images/bio/booking,
  assistant IA genre+bio, export CSV, pagination), Liste d'attente (conversion → carte, pagination),
  Réservations, Badges (CMS), Marque (logos CMS), Sections (markdown + HTML), SEO, Réglages,
  Historique, NavFooter, Gamification, Docs.
- Tableaux responsives mobile (colonnes masquées selon breakpoints), pagination des longues listes,
  suppression du débordement des grilles (`grid-cols-1`).
- Couleurs des stats admin ramenées au design system (minimaliste).

**Comptes & profil**
- « Créer un profil » → « Créer un compte » (même structure/texte que le web) ; champs pays + ville en
  selects avec recherche ; géolocalisation auto sur mobile ; show/hide mot de passe (œil) + jauge de
  force (identique web/mobile) ; icônes CTA identiques (micro chanteur) ; page mot de passe oublié /
  reset (web + mobile).
- Gestion de compte : changer email / mot de passe / supprimer / passer Premium / Business ; avatar
  (photo pro artiste, avatar animé Rive-Lottie mélomane) ; images de profil arrondies partout.
- Formulaire référencement : si l'utilisateur est connecté, plus de création de compte demandée ;
  le profil de compte ≠ rejoindre la waitlist ; profil artiste éditable dans l'admin (y compris sans compte).

**Mobile / UI**
- Topbar commune sur tous les écrans (logo + cloche notif, sans recherche au milieu sauf le globe) ;
  logo icône seul sur mobile (bleu en clair, blanc en sombre), logo horizontal sur desktop ;
  panneau de recherche refondu (parité web) ; sheet artiste aligné web (bouton retour, fermeture,
  onglets, stats) ; écran de démarrage avec dégradé + logo ; onboarding avec logo + icônes lucide
  (titres/descriptions éditables dans l'admin) ; écran localisation avant le globe.
- Icône d'app : symbole bleu foncé `#2F52E0` (comme le splash), fond blanc.

**Globe & carte**
- Clustering hiérarchique pays → villes → sous-groupes → pins ; recherche pays/ville avec filtrage
  strict des pins (pas de pins des pays voisins) ; quartiers dans la recherche ; recherche → icône
  quand repliée ; pins par popularité (anneau) puis lumineux par densité ; frontières brand.
- Fix : pins en haut à gauche (marqueurs posés avant `load`, coordonnées invalides filtrées, déclump
  position rendue) ; cluster click scope les pins ; zoom profond ; carte monochrome selon thème.

**Engagement & données**
- Vues uniques par user/appareil + compteur réinitialisable ; stats par pays des visiteurs du profil ;
  likes ; followers ; streaks de connexion ; badges/points/niveaux ; notifications (follow, like,
  booking, découverte) ; toasts d'action (suivre/liker…) ; gamification par rôle artiste/auditeur ;
  sync mobile ↔ web ; id d'appareil anonyme.
- Document de monétisation (services payants artistes / business / mélomanes).

**Emails**
- SMTP Hostinger configuré (`noreply@musimaps.com`), envoi de réinitialisation et notifications.

---

## Roadmap en cours / prochaines étapes

1. Finaliser + déployer les **pins lumineux par densité** (web puis mobile).
2. Reconstruire l'APK dès que le quota EAS revient (1er sept.) ou passage plan payant.
3. Étendre la recherche quartiers à l'autocomplete des formulaires (Mapbox neighborhood).
4. Clusters par quartier à zoom intermédiaire + filtre quartier dans la recherche.
5. Étoffer le peuplement Musibrainz « artistes populaires » et la vérification IA multi-sources.

---

*Généré à partir de la session de développement — ce document vit dans `docs/` et doit être mis à
jour à chaque grosse évolution.*

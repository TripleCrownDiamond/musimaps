# Préparation Google Play — 9 septembre 2026

## Verdict

Le projet est compilable, mais **pas encore validé pour soumission en production**.
La réussite d’un build ou d’un test navigateur ne valide pas toutes les fonctions natives,
les données de production, les déclarations Play Console ou les informations légales.

## Corrections de cette passe

- Routes publiques `/confidentialite`, `/cgu`, `/supprimer-compte`, et versions `/en/...`.
  Les anciennes routes légales redirigeaient vers l’accueil, en local et en production lors de l’audit.
- Admin → Réglages → Informations légales : éditeur, adresse, immatriculation, e-mail,
  date et trois documents FR/EN. Informations laissées vides, sans identité ni politique inventées.
- Données dans `settings.legal`, via le CMS existant : aucune nouvelle migration nécessaire.
  Identité globale dans les réglages FR ; chaque document contient ses traductions FR et EN.
  Enregistrement en brouillon ; publication volontaire. La publication sauvegarde aussi les
  dernières modifications et bloque les configurations légales partielles. Les autres réglages
  restent publiables lorsque la configuration légale n’a pas encore été commencée.
- Documents rendus en texte simple : le contenu CMS ne peut pas exécuter du HTML.
  Une page sans texte publié indique son indisponibilité, sans prétendre fournir une politique valide.
- Liens communs dans le footer web et le profil mobile. Les liens légaux existants de l’entrée
  mobile gardent leurs adresses. Le mobile ouvre les documents canoniques du site.
- Page de suppression accessible sans réinstaller l’app : connexion → édition du profil,
  ancre vers la suppression existante ; alternative de contact si l’e-mail est renseigné.
  Aucun compte réel supprimé pendant la recette.
- Profil EAS production explicite : AAB, distribution Store, identifiants de signature distants.
  Les builds preview restent des APK de test. Aucun nouveau keystore créé ni remplacé.
- Contrôle design débloqué : deux rayons de cercles remplacés par le token circulaire commun,
  sans augmenter le budget ni modifier leur aspect.

## Vérifications effectuées

- `npm run check` : réussi (141 tests unitaires, contrôles design/i18n/contrastes,
  tests carte/notifications/geo/admin/waitlist, build web/OG FR+EN et TypeScript mobile).
  La première passe confinée échouait sur la lecture réseau du CMS pour les métadonnées EN ;
  la relance avec accès réseau autorisé a réussi.
- 50 tests E2E publics réussis, dont 16 scénarios légaux sur ordinateur et viewport Pixel 7 :
  routes conservées, bonne traduction, même identité FR/EN, pas de débordement, HTML inerte,
  document absent explicite et destination de connexion conservée pour supprimer le compte.
- 2 tests E2E admin réussis, ordinateur + viewport Pixel 7 : édition, brouillon, refus de
  publication partielle, sauvegarde lors de la publication, relecture publique anglaise et
  rechargement des champs. **CMS et session simulés en mémoire**, aucune écriture réelle.
  Capture mobile des champs inspectée ; la capture longue desktop a dépassé le délai dans
  Playwright et n’est pas une validation visuelle desktop. Cette capture facultative reste
  séparée des assertions fonctionnelles ; aucun test de saisie/publication n’a été retiré.
- Audit préalable Expo Web invité : Découvrir, Sauvegardés, Profil, Notifications, création
  de compte, connexion et récupération se rendent en FR clair / EN sombre sans erreur JS.
  Cela ne valide pas une inscription réelle ou la délivrance des e-mails.
- APK local audité : cible Android API 36 ; 20 bibliothèques natives ARM64 avec alignement
  ELF ≥ 16 Ko ; vérification zipalign 16 Ko réussie. Pas de test d’exécution sur appareil 16 Ko.
- APK local signé avec **Android Debug** : destiné aux tests, pas à la mise en ligne.
  Le projet EAS existant est accessible au compte connecté ; la signature finale de l’AAB
  de production reste à vérifier. EAS prépare lui-même la signature distante : le Gradle
  généré localement avec sa signature debug n’est pas la preuve que l’AAB EAS sera debug.

## À faire avant soumission

1. Remplir, vérifier et publier les informations légales réelles depuis l’admin ; vérifier
   les pratiques décrites, les prestataires, les durées de conservation et le traitement des suppressions.
2. Déployer le web corrigé, puis tester les trois liens publics sur `musimaps.com`.
   Cette passe n’a fait ni déploiement ni publication de documents réels.
3. Recette authentifiée avec un compte jetable autorisé : inscription + confirmation,
   connexion/récupération, favoris/suivis synchronisés, photos/couverture, suppression complète
   du compte et des données associées. Les migrations/backend et le nettoyage des médias
   ne sont pas certifiés par les tests d’interface.
4. Rejouer les parcours natifs sur appareil physique (localisation refusée/autorisée,
   gestes, réseau lent/hors connexion, reprise de l’app). Expo Web ne remplace pas cette recette.
5. Générer l’AAB EAS production et vérifier sa signature/version, son contenu et le rapport
   de pré-lancement Play. Aucun AAB de production lancé dans cette passe.
6. Compléter Play Console : identité/compte, accès testeur, fiche, images, confidentialité,
   Data safety, classification et déclarations applicables. Le type et l’ancienneté du compte
   Play ne sont pas connus : certains comptes personnels doivent effectuer un test fermé
   avec 12 testeurs pendant 14 jours consécutifs avant une demande d’accès à la production.

## Écarts Profil / Modifier le profil signalés ensuite par l’utilisateur

Audit initial (avant la demande explicite de correction et de build) :

- `Dashboard.tsx` web n’affiche pas la couverture du **compte**. La couverture qu’il gère
  appartient au profil **artiste revendiqué**, distinct du compte. Le profil mobile affiche
  bien `user.coverUrl` et `user.avatarUrl`.
- Édition web : avatar 80 px, sous la couverture, couverture 144/176 px.
  Édition mobile : avatar 78 px avec marge négative, couverture 170 px.
- Profil mobile : couverture 205 px, avatar 124 px qui chevauche ; pas d’équivalent compte
  correspondant dans le dashboard web actuel.
- Édition web : `AnimatedAvatar` n’a pas de gestion d’erreur photo. Son fallback est une
  animation Rive ; le mobile bascule vers les initiales en cas d’erreur.
- Mobile : recadrage proposé en carré pour l’avatar et 16:9 pour la cover ; le web utilise
  le fichier choisi sans cette étape de recadrage.

Ces écarts de **présentation** ont ensuite été corrigés et vérifiés le 9 septembre :
voir [QA-PROFILE-MEDIA.md](QA-PROFILE-MEDIA.md). L’APK de test inclut cette harmonisation.
Le sélecteur/recadrage natif reste propre à Android/iOS, distinct du sélecteur web.

**Blocage backend résolu après intervention de l’utilisateur :** `profiles.cover_url`
manquait initialement (réponse 400). Après exécution manuelle de
`supabase/migrations/00063_profile_cover.sql`, le contrôle distant en lecture seule retourne
HTTP 200. Aucun profil lu/modifié par ce contrôle. L’APK existant supporte déjà ce champ ;
la recette réelle d’upload et de synchronisation reste à effectuer.

## Sources officielles consultées

- [Niveau d’API Android requis](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-GB_ALL)
- [Préparation/soumission Android avec EAS](https://docs.expo.dev/submit/android/)
- [Support Android des pages mémoire 16 Ko](https://developer.android.com/guide/practices/page-sizes)
- [Exigences de suppression de compte](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Tests requis pour certains comptes personnels](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)

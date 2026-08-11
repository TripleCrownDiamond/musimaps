# Plan — Amélioration de l'admin Musimaps

> Fichier de plan créé **avant** les modifications, mis à jour au fil de l'avancement.
> Chaque étape est cochée quand elle est **implémentée + validée**.

## Objectif

Connecter **tout** le branding du site aux données pilotables dans l'admin, ajouter un
**éditeur riche (markdown + HTML)**, corriger le copyright dupliqué du footer, et déployer.

## Étapes

### A. Identité / logos (nouvelle section CMS `brand`)
- [x] `cms.ts` : type `BrandContent` (navbarLogoLight/Dark, footerLogoLight/Dark, favicon, appImage) + défauts vides + `brand` dans `CmsContent`/`ContentKey`.
- [x] `sections.ts` : libellé `brand` dans `SECTION_LABELS`.
- [x] Nouvelle page admin `BrandPage.tsx` : 6 champs `ImageField` (upload Storage) + brouillon/publié (`useSection('brand')`).
- [x] Routage : `/admin/brand` (AdminApp) + entrée sidebar + carte Vue d'ensemble.
- [x] `Navbar.tsx` : affiche le logo navbar (clair/sombre selon thème), repli sur le wordmark texte (fallback cross-thème si un seul logo rempli).
- [x] `Footer.tsx` : affiche le logo footer (clair/sombre), repli sur le logo packagé.
- [x] `SeoApplier`/`seo.ts` : applique la **favicon** (`link[rel=icon]` + `apple-touch-icon`) depuis le CMS, restaure `/favicon.png` quand le champ est vide.

### B. Copyright dupliqué (footer)
- [x] `Footer.tsx` : supprime le « © » en doublon et la duplication du tagline au rendu.
- [x] Migration `00010_footer_copyright.sql` : nettoie `footer.copyright` (content + draft) en base **et** crée les lignes `brand`/`badges` manquantes. Appliquée en production et vérifiée.

### C. Éditeurs de texte → rich text (markdown + HTML)
- [x] Installer : `@uiw/react-md-editor`, `react-markdown`, `remark-gfm`, `rehype-raw`.
- [x] Composant `RichEditor` (admin, adapté clair/sombre).
- [x] Composant `RichText` (rendu public markdown + HTML, prop `asHeading` pour conserver la sémantique de titre).
- [x] SectionsPage : sous-titres, textes de features/parcours, réponses FAQ → `RichEditor`.
- [x] ArtistSignupPage : sous-titre, note de confidentialité, textes des avantages → `RichEditor`.
- [x] Landing.tsx : rendu `RichText` sur les champs convertis (philosophie en `h2`).
- [x] ArtistSignup.tsx : rendu `RichText` sur les champs convertis.

### D. Validation & déploiement
- [x] Typecheck web (`tsc -b`) + build (`vite build`) + revue de code (2 passes, points corrigés : fallback logos, favicon vide, sémantique de titre RichText).
- [x] Appliquer la migration 00010 en production (vérifiée : copyright propre, lignes brand/badges créées).
- [x] Mettre à jour ce plan.
- [x] Déployer le build web sur Hostinger (script FTP `scripts/deploy-hostinger.mjs`, `npm run deploy`).

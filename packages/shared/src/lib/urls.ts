/**
 * Adresses publiques de Musimaps — source unique de vérité.
 *
 * Le domaine était répété en dur dans quinze fichiers, et il était FAUX :
 * `musimaps.app` ne résout pas, le site vit sur `musimaps.com`. Tous les
 * partages, toutes les URLs canoniques et toutes les balises de partage
 * pointaient vers un domaine mort. Un littéral dupliqué ne se corrige jamais
 * partout ; une constante, si.
 *
 * L'app mobile n'a pas de `window.location` : quand elle partage un artiste ou
 * ouvre les conditions d'utilisation, elle a besoin de l'adresse absolue du
 * site. C'est ce que ce module fournit, aux deux plateformes.
 */

/** Racine du site public, sans barre oblique finale. */
export const SITE_URL = 'https://musimaps.com';

/**
 * Chemins des pages légales, réclamées par l'App Store et le Play Store.
 * Ils vivent ici pour que le mobile et le web pointent au même endroit.
 */
export const LEGAL_PATHS = {
  terms: '/cgu',
  privacy: '/confidentialite',
} as const;

/** Préfixe de langue : le français vit à la racine, l'anglais sous `/en`. */
function localized(path: string, lang: 'fr' | 'en' = 'fr'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return lang === 'en' ? `/en${clean}` : clean;
}

/**
 * URL absolue d'un chemin du site, dans la langue demandée.
 *
 * La racine française garde sa barre oblique (`musimaps.com/`), tout le reste
 * n'en porte jamais : `/en/` et `/en` indexés séparément, ce sont deux URLs
 * canoniques pour une seule page.
 */
export function siteUrl(path = '/', lang: 'fr' | 'en' = 'fr'): string {
  const localizedPath = localized(path, lang);
  if (localizedPath === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${localizedPath.replace(/\/+$/, '')}`;
}

/**
 * Page publique d'un artiste. Accepte le slug personnalisé quand il existe,
 * l'identifiant sinon — c'est la règle appliquée partout dans le produit.
 */
export function artistUrl(slugOrId: string, lang: 'fr' | 'en' = 'fr'): string {
  return siteUrl(`/artist/${slugOrId}`, lang);
}

/** Conditions générales d'utilisation. */
export function termsUrl(lang: 'fr' | 'en' = 'fr'): string {
  return siteUrl(LEGAL_PATHS.terms, lang);
}

/** Politique de confidentialité. */
export function privacyUrl(lang: 'fr' | 'en' = 'fr'): string {
  return siteUrl(LEGAL_PATHS.privacy, lang);
}

/**
 * Aide à la résolution des logos de marque.
 *
 * Le site embarque les logos officiels dans /brand/ (logo-light = noir pour le
 * thème clair, logo-dark = blanc pour le thème sombre, logo-color = version
 * couleur). Les URLs de logos publiées dans le CMS ont priorité — SAUF si
 * elles pointent vers les anciens logos cyan (téléversés avant la nouvelle
 * identité) : on les ignore alors pour retomber sur l'officiel embarqué.
 */

/** Anciens fichiers de l'identité précédente, encore publiés dans le CMS. */
const LEGACY_BRAND_FILES = [
  '/cms/brand-navbar-light.png',
  '/cms/brand-navbar-dark.png',
  '/cms/brand-footer-light.png',
  '/cms/brand-footer-dark.png',
  '/cms/1785869737334-favicon.png',
  '/cms/1785869744553-favicon.png',
]

/** Une URL pointe-t-elle vers un ancien asset de marque (à ignorer) ? */
export function isLegacyBrandUrl(url: string): boolean {
  if (!url) return false
  return LEGACY_BRAND_FILES.some((fragment) => url.includes(fragment))
}

export type BrandTheme = 'light' | 'dark'

/**
 * Choisit le logo CMS utilisable pour un thème donné (clair / sombre), en
 * ignorant les anciennes URLs. Retourne null quand aucun logo exploitable —
 * l'appelant retombe alors sur le logo officiel embarqué.
 */
export function resolveBrandLogo(
  lightUrl: string,
  darkUrl: string,
  theme: BrandTheme,
): string | null {
  const light = lightUrl && !isLegacyBrandUrl(lightUrl) ? lightUrl : ''
  const dark = darkUrl && !isLegacyBrandUrl(darkUrl) ? darkUrl : ''
  // Un seul logo rempli sert les deux thèmes.
  const chosen = theme === 'dark' ? dark || light : light || dark
  return chosen || null
}

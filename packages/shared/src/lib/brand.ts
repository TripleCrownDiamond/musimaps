/**
 * Identité visuelle — partagé web + mobile.
 *
 * Réunion de deux modules qui étaient complémentaires plutôt que jumeaux :
 *   - le web avait `resolveBrandLogo` (choix du logo selon le thème) ;
 *   - le mobile avait le chargement CMS (`parseBrand`, `fetchCmsBrand`).
 * Seule la liste des anciens logos était commune — et c'est justement elle
 * qui aurait fini par diverger, laissant une plateforme afficher l'ancien
 * logo cyan après une mise à jour faite d'un seul côté.
 *
 * Le site embarque les logos officiels dans /brand/ (logo-light = noir pour
 * le thème clair, logo-dark = blanc pour le sombre, logo-color = version
 * couleur). Les URLs publiées dans le CMS ont priorité — sauf si elles
 * pointent vers les anciens logos.
 */
import { getSupabase } from '../runtime';

export interface BrandContent {
  navbarLogoLight: string;
  navbarLogoDark: string;
  appImage: string;
}

/** Aucun logo CMS → repli sur les assets embarqués. */
export const DEFAULT_BRAND: BrandContent = {
  navbarLogoLight: '',
  navbarLogoDark: '',
  appImage: '',
};

/**
 * Anciens fichiers de l'identité précédente (logos cyan), encore publiés
 * dans le CMS : ignorés pour retomber sur les logos officiels embarqués.
 */
const LEGACY_BRAND_FILES = [
  '/cms/brand-navbar-light.png',
  '/cms/brand-navbar-dark.png',
  '/cms/brand-footer-light.png',
  '/cms/brand-footer-dark.png',
  '/cms/1785869737334-favicon.png',
  '/cms/1785869744553-favicon.png',
];

export function isLegacyBrandUrl(url: string): boolean {
  if (!url) return false;
  return LEGACY_BRAND_FILES.some((fragment) => url.includes(fragment));
}

export type BrandTheme = 'light' | 'dark';

/**
 * Choisit le logo CMS utilisable pour un thème donné, en ignorant les
 * anciennes URLs. Retourne null quand aucun logo n'est exploitable —
 * l'appelant retombe alors sur le logo officiel embarqué.
 */
export function resolveBrandLogo(
  lightUrl: string,
  darkUrl: string,
  theme: BrandTheme,
): string | null {
  const light = lightUrl && !isLegacyBrandUrl(lightUrl) ? lightUrl : '';
  const dark = darkUrl && !isLegacyBrandUrl(darkUrl) ? darkUrl : '';
  // Un seul logo rempli sert les deux thèmes.
  const chosen = theme === 'dark' ? dark || light : light || dark;
  return chosen || null;
}

/**
 * Valide la version PUBLIÉE du CMS (JSON sérialisé) et la convertit en
 * BrandContent sûr. Retourne null si aucune donnée exploitable (l'appelant
 * retombe alors sur DEFAULT_BRAND).
 */
export function parseBrand(raw: unknown): BrandContent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const navbarLogoLight = asString(record.navbarLogoLight);
  const navbarLogoDark = asString(record.navbarLogoDark);
  const appImage = asString(record.appImage);
  const brand: BrandContent = {
    navbarLogoLight: isLegacyBrandUrl(navbarLogoLight) ? '' : navbarLogoLight,
    navbarLogoDark: isLegacyBrandUrl(navbarLogoDark) ? '' : navbarLogoDark,
    appImage: isLegacyBrandUrl(appImage) ? '' : appImage,
  };
  const hasAny = Boolean(brand.navbarLogoLight || brand.navbarLogoDark || brand.appImage);
  return hasAny ? brand : null;
}

/**
 * Charge l'identité visuelle PUBLIÉE depuis la vue site_content_public
 * (clé 'brand'). Retombe sur DEFAULT_BRAND hors-ligne ou si rien n'est publié.
 */
export async function fetchCmsBrand(): Promise<BrandContent> {
  const supabase = getSupabase();
  if (!supabase) return DEFAULT_BRAND;
  try {
    const { data } = await supabase
      .from('site_content_public')
      .select('key, content')
      .eq('key', 'brand')
      .maybeSingle();
    return parseBrand(data?.content) ?? DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}

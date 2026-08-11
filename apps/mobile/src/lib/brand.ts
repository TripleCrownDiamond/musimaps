import { supabase } from './supabase';

/**
 * Identité visuelle pilotée par le CMS web (table site_content, clé 'brand').
 * Les images sont des URLs Supabase Storage publiées depuis l'admin.
 */
export interface BrandContent {
  navbarLogoLight: string;
  navbarLogoDark: string;
  appImage: string;
}

/** Valeurs par défaut : aucun logo CMS → repli sur les assets embarqués. */
export const DEFAULT_BRAND: BrandContent = {
  navbarLogoLight: '',
  navbarLogoDark: '',
  appImage: '',
};

/**
 * Anciens assets de l'identité précédente (logos cyan) encore publiés dans le
 * CMS : ignorés pour retomber sur les logos officiels embarqués.
 */
const LEGACY_BRAND_FILES = [
  '/cms/brand-navbar-light.png',
  '/cms/brand-navbar-dark.png',
  '/cms/brand-footer-light.png',
  '/cms/brand-footer-dark.png',
  '/cms/1785869737334-favicon.png',
  '/cms/1785869744553-favicon.png',
];

/** Une URL pointe-t-elle vers un ancien asset de marque (à ignorer) ? */
function isLegacyBrandUrl(url: string): boolean {
  return LEGACY_BRAND_FILES.some((fragment) => url.includes(fragment));
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
  // Les anciens logos cyan sont ignorés : on garde uniquement les URLs
  // réellement personnalisées (téléversées après la nouvelle identité).
  const navbarLogoLight = asString(record.navbarLogoLight);
  const navbarLogoDark = asString(record.navbarLogoDark);
  const appImage = asString(record.appImage);
  const brand: BrandContent = {
    navbarLogoLight: isLegacyBrandUrl(navbarLogoLight) ? '' : navbarLogoLight,
    navbarLogoDark: isLegacyBrandUrl(navbarLogoDark) ? '' : navbarLogoDark,
    appImage: isLegacyBrandUrl(appImage) ? '' : appImage,
  };
  const hasAny = Boolean(
    brand.navbarLogoLight || brand.navbarLogoDark || brand.appImage,
  );
  return hasAny ? brand : null;
}

/**
 * Charge l'identité visuelle PUBLIÉE depuis la vue site_content_public
 * (clé 'brand'). Retombe sur DEFAULT_BRAND hors-ligne ou si rien n'est publié.
 */
export async function fetchCmsBrand(): Promise<BrandContent> {
  const client = supabase;
  if (!client) return DEFAULT_BRAND;
  try {
    const { data } = await client
      .from('site_content_public')
      .select('key, content')
      .eq('key', 'brand')
      .maybeSingle();
    return parseBrand(data?.content) ?? DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}

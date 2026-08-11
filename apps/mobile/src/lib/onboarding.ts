import { supabase } from './supabase';

/**
 * Contenu d'une slide d'onboarding piloté par le CMS web (table site_content,
 * clé 'onboarding'). Les icônes sont des noms lucide (ex : 'Globe') valables
 * dans lucide-react-native.
 */
export interface CmsOnboardingSlide {
  icon: string;
  chip: string;
  title: string;
  text: string;
}

/** Extraits valides d'une slide CMS (tolérant aux champs manquants). */
function parseSlide(raw: unknown): CmsOnboardingSlide | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const slide: CmsOnboardingSlide = {
    icon: asString(record.icon),
    chip: asString(record.chip),
    title: asString(record.title),
    text: asString(record.text),
  };
  // Une slide sans titre ni texte n'est pas exploitable.
  return slide.title || slide.text ? slide : null;
}

/**
 * Charge la version PUBLIÉE de l'onboarding (clé 'onboarding') dans la langue
 * active (content = FR, content_en = EN). Retourne null si rien d'exploitable
 * — l'appelant retombe alors sur ses textes i18n locaux.
 */
export async function fetchCmsOnboarding(
  lang: 'fr' | 'en' = 'fr',
): Promise<CmsOnboardingSlide[] | null> {
  const client = supabase;
  if (!client) return null;
  try {
    const { data } = await client
      .from('site_content_public')
      .select('content, content_en')
      .eq('key', 'onboarding')
      .maybeSingle();
    const published = lang === 'en' ? data?.content_en : data?.content;
    if (!published || typeof published !== 'object') return null;
    const rawSlides = (published as Record<string, unknown>).slides;
    if (!Array.isArray(rawSlides)) return null;
    const slides = rawSlides.map(parseSlide).filter((s): s is CmsOnboardingSlide => s !== null);
    return slides.length > 0 ? slides : null;
  } catch {
    return null;
  }
}

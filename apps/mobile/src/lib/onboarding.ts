import { supabase } from './supabase';
import { parseOnboardingSlides, type OnboardingSlide } from '@musimaps/shared';

/**
 * Contenu d'une slide d'onboarding piloté par le CMS web (table site_content,
 * clé 'onboarding'). Les anciens noms d'icônes sélectionnent désormais les
 * illustrations embarquées ; les textes restent éditables et traduits.
 */
export type CmsOnboardingSlide = OnboardingSlide;

/** Textes de l'écran d'entrée, publiés dans la même section que les slides. */
export interface CmsStartScreen {
  tagline: string;
  explore: string;
  signup: string;
}

/**
 * Charge les textes PUBLIÉS de l'écran d'entrée.
 *
 * Chaque champ est indépendant : un champ laissé vide dans l'admin ne doit pas
 * effacer le libellé d'un bouton — l'écran retombe alors sur son texte i18n.
 * D'où les chaînes vides plutôt qu'un `null` global.
 */
export async function fetchCmsStart(lang: 'fr' | 'en' = 'fr'): Promise<CmsStartScreen | null> {
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
    const raw = (published as Record<string, unknown>).start;
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;
    const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
    return {
      tagline: asString(record.tagline),
      explore: asString(record.explore),
      signup: asString(record.signup),
    };
  } catch {
    return null;
  }
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
    return parseOnboardingSlides(rawSlides);
  } catch {
    return null;
  }
}

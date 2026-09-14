import type { MessageKey } from '../i18n';

/** Ordered product journey; artwork files are bundled separately by each UI. */
export const ONBOARDING_ARTWORK = [
  { id: 'globe', icon: 'Globe', chip: 'onb.1.chip', title: 'onb.1.title', accent: 'onb.1.accent', text: 'onb.1.text' },
  { id: 'search', icon: 'Search', chip: 'onb.2.chip', title: 'onb.2.title', accent: 'onb.2.accent', text: 'onb.2.text' },
  { id: 'favorites', icon: 'Heart', chip: 'onb.3.chip', title: 'onb.3.title', accent: 'onb.3.accent', text: 'onb.3.text' },
  { id: 'rewards', icon: 'Trophy', chip: 'onb.4.chip', title: 'onb.4.title', accent: 'onb.4.accent', text: 'onb.4.text' },
] as const satisfies ReadonlyArray<{ id: string; icon: string; chip: MessageKey; title: MessageKey; accent: MessageKey; text: MessageKey }>;

export type OnboardingArtworkId = (typeof ONBOARDING_ARTWORK)[number]['id'];

/** Legacy editorial fields remain compatible with already-published CMS content. */
export interface OnboardingSlide {
  icon: string;
  chip: string;
  title: string;
  text: string;
  /** Optional locale-specific replacement; bundled artwork works offline. */
  image?: string;
}

export function onboardingArtwork(icon: string, index: number) {
  return ONBOARDING_ARTWORK.find((artwork) => artwork.icon === icon)
    ?? ONBOARDING_ARTWORK[Math.abs(index) % ONBOARDING_ARTWORK.length];
}

/** Keep custom CMS titles intact; highlight a translated trailing phrase only. */
export function onboardingTitleParts(title: string, accent: string) {
  const trimmed = title.trim();
  if (!accent || !trimmed.toLocaleLowerCase().endsWith(accent.toLocaleLowerCase())) {
    return { lead: trimmed, accent: '' };
  }
  return { lead: trimmed.slice(0, -accent.length).trimEnd(), accent: trimmed.slice(-accent.length) };
}

export function parseOnboardingSlides(raw: unknown): OnboardingSlide[] | null {
  if (!Array.isArray(raw)) return null;
  const slides = raw.flatMap((value): OnboardingSlide[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    const text = (key: string) => typeof record[key] === 'string' ? record[key].trim() : '';
    const image = /^https:\/\//i.test(text('image')) ? text('image') : undefined;
    const slide = { icon: text('icon'), chip: text('chip'), title: text('title'), text: text('text'), image };
    return image || slide.title || slide.text || ONBOARDING_ARTWORK.some((item) => item.icon === slide.icon)
      ? [slide] : [];
  });
  return slides.length ? slides : null;
}

import { describe, expect, it } from 'vitest';
import { ONBOARDING_ARTWORK, onboardingArtwork, onboardingTitleParts, parseOnboardingSlides } from './onboarding';
import { translate } from '../i18n';

describe('illustrated onboarding', () => {
  it('orders the supplied illustrations by product purpose', () => {
    expect(ONBOARDING_ARTWORK.map((item) => item.id)).toEqual(['globe', 'search', 'favorites', 'rewards']);
    expect(onboardingArtwork('Heart', 0).id).toBe('favorites');
    expect(onboardingArtwork('Unknown', 1).id).toBe('search');
  });
  it('supports published legacy CMS records and image-only replacements', () => {
    expect(parseOnboardingSlides([{ icon: 'Globe', title: 'Globe' }])?.[0].icon).toBe('Globe');
    expect(parseOnboardingSlides([{ image: 'https://example.com/art.png' }])?.[0].image).toBe('https://example.com/art.png');
    expect(parseOnboardingSlides([null, {}, { image: 'javascript:bad' }])).toBeNull();
  });
  it('keeps localized title accents separate without losing custom copy', () => {
    for (const lang of ['fr', 'en'] as const) {
      for (const artwork of ONBOARDING_ARTWORK) {
        const title = translate(lang, artwork.title);
        const parts = onboardingTitleParts(title, translate(lang, artwork.accent));
        expect(parts.accent).not.toBe('');
        expect(`${parts.lead} ${parts.accent}`).toBe(title);
      }
    }
    expect(onboardingTitleParts('Custom title', 'discovery')).toEqual({ lead: 'Custom title', accent: '' });
  });
  it('keeps CMS strings trimmed and rejects unsafe image URLs', () => {
    expect(parseOnboardingSlides([{ icon: ' Search ', image: ' http://insecure.test/a.png ', text: ' Description ' }])?.[0])
      .toEqual({ icon: 'Search', image: undefined, chip: '', title: '', text: 'Description' });
  });
});

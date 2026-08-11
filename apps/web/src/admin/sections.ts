import type { ContentKey } from '@/lib/cms'

/** Libellés français des sections pilotées par le CMS. */
export const SECTION_LABELS: Record<ContentKey, string> = {
  landing: 'Sections (landing)',
  seo: 'SEO',
  nav: 'Navigation',
  footer: 'Footer',
  badges: 'Catalogue badges',
  brand: 'Logo & favicon',
  artistSignup: 'Page artistes',
  settings: 'Réglages',
  onboarding: 'Onboarding mobile',
}

import { useEffect } from 'react'
import { useCms } from '@/context/CmsContext'
import { useLanguage } from '@/i18n/LanguageContext'

/**
 * Override partiel du SEO pour une page donnée.
 * Les champs fournis écrasent ceux du CMS ; les champs omis gardent la
 * valeur CMS (typiquement la landing).
 */
interface PageSeo {
  title?: string
  description?: string
  ogTitle?: string
  ogDescription?: string
}

/**
 * Hook SEO par page : merge les overrides fournis avec le SEO CMS global
 * et applique le résultat via `applySeo`.
 *
 * Usage :
 *   usePageSeo({ title: '…', description: '…' })
 */
export function usePageSeo(overrides: PageSeo) {
  const { content, cacheVersion } = useCms()
  const { lang } = useLanguage()

  useEffect(() => {
    const base = content.seo
    const merged = {
      ...base,
      ...(overrides.title ? { title: overrides.title } : {}),
      ...(overrides.description ? { description: overrides.description } : {}),
      ...(overrides.ogTitle ? { ogTitle: overrides.ogTitle } : {}),
      ...(overrides.ogDescription ? { ogDescription: overrides.ogDescription } : {}),
    }
    // Dynamically import to avoid circular deps
    import('@/lib/seo').then(({ applySeo }) => applySeo(merged, lang, cacheVersion))
  }, [content.seo, lang, cacheVersion, overrides.title, overrides.description, overrides.ogTitle, overrides.ogDescription])
}

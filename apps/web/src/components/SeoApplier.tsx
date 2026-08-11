import { useEffect } from 'react'
import { useCms } from '@/context/CmsContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { applySeo, applyBrand } from '@/lib/seo'

/**
 * Applique title + meta (description, OG, hreflang, canonical…), favicon et
 * logos depuis le CMS. Le contenu SEO est celui de la langue active (le CMS
 * publie un jeu de meta par langue).
 */
export default function SeoApplier() {
  const { content, cacheVersion } = useCms()
  const { lang } = useLanguage()

  useEffect(() => {
    applySeo(content.seo, lang, cacheVersion)
  }, [content.seo, lang, cacheVersion])

  useEffect(() => {
    applyBrand(content.brand, cacheVersion)
  }, [content.brand, cacheVersion])

  return null
}

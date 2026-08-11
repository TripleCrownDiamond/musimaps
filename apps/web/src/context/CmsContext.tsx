import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_CONTENT,
  fetchCacheVersion,
  fetchContent,
  fetchDraftContent,
  type CmsContent,
} from '@/lib/cms'
import { useLanguage } from '@/i18n/LanguageContext'

interface CmsContextValue {
  content: CmsContent
  loading: boolean
  /** Version de cache ?v=N appliquée aux fichiers stables (favicon, og-image…). */
  cacheVersion: number
  reload: () => Promise<void>
}

const CmsContext = createContext<CmsContextValue>({
  content: DEFAULT_CONTENT,
  loading: true,
  cacheVersion: 1,
  reload: async () => {},
})

export function CmsProvider({
  children,
  source = 'published',
}: {
  children: ReactNode
  /** `draft` : sert l'aperçu avec les brouillons en cours. */
  source?: 'published' | 'draft'
}) {
  const [content, setContent] = useState<CmsContent>(DEFAULT_CONTENT)
  const [loading, setLoading] = useState(true)
  const [cacheVersion, setCacheVersion] = useState(1)
  // Le contenu CMS se traduit avec la langue active (voir lib/cms.ts).
  const { lang } = useLanguage()

  const reload = useCallback(async () => {
    setLoading(true)
    const [next, version] = await Promise.all([
      source === 'draft' ? fetchDraftContent(lang) : fetchContent(lang),
      fetchCacheVersion(),
    ])
    setContent(next)
    setCacheVersion(version)
    setLoading(false)
  }, [source, lang])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo(
    () => ({ content, loading, cacheVersion, reload }),
    [content, loading, cacheVersion, reload],
  )

  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>
}

export function useCms() {
  return useContext(CmsContext)
}

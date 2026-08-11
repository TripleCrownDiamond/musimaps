import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  saveDraft,
  publishContent,
  discardDraft,
  fetchSectionState,
  type ContentKey,
} from '@/lib/cms'
import type { Lang } from '@/i18n/translations'
import { useCms } from '@/context/CmsContext'

export interface SectionResult {
  draft: unknown
  published: unknown
  publishedAt: string | null
  dirty: boolean
  loading: boolean
  save: (content: unknown) => Promise<{ ok: boolean; error?: string }>
  publish: () => Promise<{ ok: boolean; error?: string }>
  discard: () => Promise<{ ok: boolean; error?: string }>
  reload: () => Promise<void>
}

/**
 * État éditorial d'une section : brouillon vs version publiée, pour la langue
 * éditée (`lang`). Basculer FR/EN recharge le brouillon de l'autre langue.
 */
export function useSection(key: ContentKey, lang: Lang = 'fr'): SectionResult {
  const { reload: reloadPublic } = useCms()
  const [draft, setDraft] = useState<unknown>(null)
  const [published, setPublished] = useState<unknown>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const state = await fetchSectionState(key, lang)
    setDraft(state.draft)
    setPublished(state.published)
    setPublishedAt(state.publishedAt)
    setLoading(false)
  }, [key, lang])

  useEffect(() => {
    void reload()
  }, [reload])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(published),
    [draft, published],
  )

  const save = useCallback(
    async (content: unknown) => {
      const result = await saveDraft(key, content, lang)
      if (result.ok) await reload()
      return result
    },
    [key, lang, reload],
  )

  const publish = useCallback(async () => {
    const result = await publishContent(key)
    if (result.ok) {
      await reload()
      // Met à jour le contenu visible (SEO, landing…) côté public.
      await reloadPublic()
    }
    return result
  }, [key, reload, reloadPublic])

  const discard = useCallback(async () => {
    const result = await discardDraft(key, lang)
    if (result.ok) await reload()
    return result
  }, [key, lang, reload])

  return { draft, published, publishedAt, dirty, loading, save, publish, discard, reload }
}

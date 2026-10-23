import { useEffect, useState } from 'react'
import { Check, ListPlus, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  addToCollection,
  COLLECTION_MAX_ITEMS,
  COLLECTION_TITLE_MAX,
  createCollection,
  fetchCollectionsContaining,
  fetchMyCollections,
  removeFromCollection,
  type CollectionSummary,
} from '@musimaps/shared'
import { useLanguage } from '../../i18n/LanguageContext'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'

/**
 * Ranger un artiste dans une sélection, ou en créer une — même parcours que
 * `AddToCollectionSheet` côté mobile ; logique dans `@musimaps/shared/lib/community`.
 */
export default function AddToCollectionDialog({
  artistId,
  open,
  onOpenChange,
}: {
  artistId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLanguage()
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null)
  const [containing, setContaining] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.all([fetchMyCollections(), fetchCollectionsContaining(artistId)]).then(([mine, inside]) => {
      if (cancelled) return
      setCollections(mine)
      setContaining(new Set(inside))
    })
    return () => {
      cancelled = true
    }
  }, [open, artistId])

  const toggle = async (collection: CollectionSummary) => {
    setBusy(collection.id)
    const inside = containing.has(collection.id)
    const result = inside
      ? await removeFromCollection(collection.id, artistId)
      : await addToCollection(collection.id, artistId)
    setBusy(null)
    if (!result.ok) {
      toast.error(result.error === 'collection_full' ? t('collection.full', { max: COLLECTION_MAX_ITEMS }) : t('community.error'))
      return
    }
    setContaining((current) => {
      const next = new Set(current)
      if (inside) next.delete(collection.id)
      else next.add(collection.id)
      return next
    })
    toast.success(t(inside ? 'collection.removed' : 'collection.added', { title: collection.title }))
  }

  const create = async () => {
    if (!title.trim()) return toast.error(t('collection.titleRequired'))
    setBusy('new')
    const created = await createCollection({ title })
    if ('error' in created) {
      setBusy(null)
      return toast.error(t('community.error'))
    }
    const added = await addToCollection(created.id, artistId)
    setBusy(null)
    if (!added.ok) return toast.error(t('community.error'))
    const fresh: CollectionSummary = {
      id: created.id, title: title.trim(), description: '', isPublic: true,
      updatedAt: new Date().toISOString(), itemCount: 1, likeCount: 0, covers: [],
    }
    setCollections((current) => [fresh, ...(current ?? [])])
    setContaining((current) => new Set(current).add(created.id))
    setTitle('')
    toast.success(t('collection.added', { title: fresh.title }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-brand-deep dark:text-brand" /> {t('collection.addTo')}
          </DialogTitle>
          <DialogDescription>{t('collection.addToHint')}</DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto">
          {collections === null ? (
            <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-brand-deep" />
          ) : collections.length === 0 ? (
            <p className="py-2 text-sm text-secondary-text">{t('collection.noneYet')}</p>
          ) : (
            collections.map((collection) => {
              const inside = containing.has(collection.id)
              return (
                <button
                  key={collection.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void toggle(collection)}
                  aria-pressed={inside}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors disabled:opacity-60 ${
                    inside ? 'border-brand-deep bg-brand-soft' : 'border-hairline-strong hover:bg-secondary-bg'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{collection.title}</span>
                    <span className="block text-xs font-normal text-secondary-text">
                      {t('collection.artists', { n: collection.itemCount })}
                    </span>
                  </span>
                  {busy === collection.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : inside ? (
                    <Check className="h-4 w-4 shrink-0 text-brand-deep dark:text-brand" />
                  ) : (
                    <Plus className="h-4 w-4 shrink-0" />
                  )}
                </button>
              )
            })
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void create()
          }}
          className="mt-3 flex gap-2 border-t border-hairline pt-4"
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={COLLECTION_TITLE_MAX}
            placeholder={t('collection.titlePlaceholder')}
            aria-label={t('collection.new')}
            className="min-w-0 flex-1 rounded-full border border-hairline-strong bg-transparent px-4 py-2.5 text-sm outline-none focus:border-brand-deep"
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-deep px-4 py-2.5 text-sm font-bold text-brand-deep-foreground disabled:opacity-60"
          >
            {busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t('collection.create')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Flag, Heart, Loader2, Lock, Pencil, Share2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  COLLECTION_DESCRIPTION_MAX,
  COLLECTION_TITLE_MAX,
  collectionUrl,
  deleteCollection,
  fetchCollection,
  likeCollection,
  onUserBlocked,
  profilePath,
  removeFromCollection,
  unlikeCollection,
  updateCollection,
  type CollectionDetail,
} from '@musimaps/shared'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { AccountAvatar } from '../components/AccountMedia'
import { SecondaryPageHeader } from '../components/SecondaryPageHeader'
import { shareLink } from '../components/community/CommunityCards'
import ReportDialog from '../components/ReportDialog'
import { Switch } from '../components/ui/switch'

/**
 * Sélection d'artistes (`/selection/:id`) — lecture pour tous si elle est
 * publique, édition par son auteur. Même contenu que `CollectionScreen`
 * côté mobile. Données : RPC `get_collection`.
 */
export default function CollectionPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const localize = useLocalizedPath()
  const navigate = useNavigate()
  const [collection, setCollection] = useState<CollectionDetail | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: '', description: '', isPublic: true })
  const [busy, setBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCollection(undefined)
    void fetchCollection(id).then((data) => {
      if (!cancelled) setCollection(data)
    })
    return () => {
      cancelled = true
    }
  }, [id, user?.id])

  useEffect(() => onUserBlocked(() => navigate(localize('/communaute'))), [navigate, localize])

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(localize('/communaute')))

  if (collection === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white">
        <Loader2 className="h-7 w-7 animate-spin text-brand-deep" />
      </div>
    )
  }

  if (collection === null) {
    return (
      <main className="min-h-screen bg-warm-white px-5 pt-36 pb-24 sm:px-6 md:px-12 md:pt-44">
        <div className="mx-auto w-full max-w-3xl">
          <SecondaryPageHeader onBack={back} backLabel={t('common.back')} />
          <p className="rounded-3xl border border-hairline bg-surface p-8 text-center text-secondary-text">{t('collection.notFound')}</p>
        </div>
      </main>
    )
  }

  const ownerName = collection.owner.displayName || collection.owner.handle || '—'

  const toggleLike = async () => {
    if (!user) return toast.error(t('collection.loginToLike'))
    setBusy(true)
    const result = collection.likedByMe ? await unlikeCollection(collection.id) : await likeCollection(collection.id)
    setBusy(false)
    if (!result.ok) return toast.error(t('community.error'))
    setCollection({
      ...collection,
      likedByMe: !collection.likedByMe,
      likeCount: collection.likeCount + (collection.likedByMe ? -1 : 1),
    })
  }

  const startEdit = () => {
    setDraft({ title: collection.title, description: collection.description, isPublic: collection.isPublic })
    setEditing(true)
  }

  const save = async () => {
    if (!draft.title.trim()) return toast.error(t('collection.titleRequired'))
    setBusy(true)
    const result = await updateCollection(collection.id, draft)
    setBusy(false)
    if (!result.ok) return toast.error(t('community.error'))
    setCollection({ ...collection, ...draft, title: draft.title.trim(), description: draft.description.trim() })
    setEditing(false)
  }

  const remove = async () => {
    if (!window.confirm(t('collection.deleteConfirm'))) return
    setBusy(true)
    const result = await deleteCollection(collection.id)
    setBusy(false)
    if (!result.ok) return toast.error(t('community.error'))
    navigate(localize('/communaute'), { replace: true })
  }

  const removeArtist = async (artistId: string) => {
    const result = await removeFromCollection(collection.id, artistId)
    if (!result.ok) return toast.error(t('community.error'))
    setCollection({
      ...collection,
      artists: collection.artists.filter((artist) => artist.id !== artistId),
      itemCount: collection.itemCount - 1,
    })
    toast.success(t('collection.removed', { title: collection.title }))
  }

  const field = 'w-full rounded-2xl border border-hairline-strong bg-transparent px-4 py-3 text-sm outline-none focus:border-brand-deep'

  return (
    <main className="min-h-screen bg-warm-white px-5 pt-36 pb-24 sm:px-6 md:px-12 md:pt-44">
      <div className="mx-auto w-full max-w-3xl">
        <SecondaryPageHeader onBack={back} backLabel={t('common.back')} />

        <section className="rounded-[2rem] border border-hairline bg-surface p-6 shadow-sm sm:p-8">
          {editing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
              className="grid gap-3"
            >
              <label className="text-sm font-medium">
                {t('collection.titleLabel')}
                <input
                  value={draft.title}
                  maxLength={COLLECTION_TITLE_MAX}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  className={`mt-1.5 ${field}`}
                />
              </label>
              <label className="text-sm font-medium">
                {t('collection.description')}
                <textarea
                  value={draft.description}
                  maxLength={COLLECTION_DESCRIPTION_MAX}
                  rows={3}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  className={`mt-1.5 resize-none ${field}`}
                />
              </label>
              <label className="flex items-center justify-between gap-4 rounded-2xl bg-secondary-bg px-4 py-3 text-sm">
                <span>
                  <span className="block font-semibold">{draft.isPublic ? t('collection.public') : t('collection.private')}</span>
                  <span className="block text-xs text-secondary-text">{t('collection.publicHint')}</span>
                </span>
                <Switch checked={draft.isPublic} onCheckedChange={(isPublic) => setDraft({ ...draft, isPublic })} />
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="rounded-full bg-brand-deep px-5 py-2.5 text-sm font-bold text-brand-deep-foreground disabled:opacity-60">
                  {t('collection.save')}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-hairline-strong px-5 py-2.5 text-sm font-semibold">
                  {t('report.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="display-font flex items-center gap-2 text-3xl font-bold">
                {!collection.isPublic && <Lock className="h-5 w-5 shrink-0 text-secondary-text" aria-label={t('collection.private')} />}
                {collection.title}
              </h1>
              {collection.description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-secondary-text">{collection.description}</p>}

              <div className="mt-4 flex items-center gap-3">
                <AccountAvatar name={ownerName} image={collection.owner.avatarUrl} variant="row" />
                <span className="text-sm">
                  {collection.owner.handle ? (
                    <Link to={localize(profilePath(collection.owner.handle))} className="font-semibold hover:underline">
                      {t('collection.by', { name: ownerName })}
                    </Link>
                  ) : (
                    <span className="font-semibold">{t('collection.by', { name: ownerName })}</span>
                  )}
                  <span className="block text-xs text-secondary-text">
                    {t('collection.artists', { n: collection.itemCount })} · {t('collection.likes', { n: collection.likeCount })}
                  </span>
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {!collection.isMine && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleLike()}
                    aria-pressed={collection.likedByMe}
                    className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60 ${
                      collection.likedByMe ? 'bg-brand text-black' : 'border border-hairline-strong hover:bg-secondary-bg'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${collection.likedByMe ? 'fill-current' : ''}`} /> {t('collection.like')}
                  </button>
                )}
                {collection.isPublic && (
                  <button
                    type="button"
                    onClick={() => void shareLink(collectionUrl(collection.id, lang), collection.title, () => toast.success(t('community.linkCopied')))}
                    className="flex items-center gap-2 rounded-full border border-hairline-strong px-5 py-3 text-sm font-semibold hover:bg-secondary-bg"
                  >
                    <Share2 className="h-4 w-4" /> {t('community.share')}
                  </button>
                )}
                {collection.isMine && (
                  <>
                    <button type="button" onClick={startEdit} className="flex items-center gap-2 rounded-full border border-hairline-strong px-5 py-3 text-sm font-semibold hover:bg-secondary-bg">
                      <Pencil className="h-4 w-4" /> {t('collection.edit')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => void remove()} className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" /> {t('collection.delete')}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </section>

        <section className="mt-6">
          {collection.artists.length === 0 ? (
            <p className="rounded-3xl border border-hairline bg-surface p-6 text-sm text-secondary-text">{t('collection.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {collection.artists.map((artist) => (
                <li key={artist.id} className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-3">
                  <Link to={localize(`/artist/${artist.slug || artist.id}`)} className="flex min-w-0 flex-1 items-center gap-3">
                    <AccountAvatar name={artist.name} image={artist.image} variant="row" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{artist.name}</span>
                      <span className="block truncate text-xs text-secondary-text">
                        {[artist.genre, artist.city].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                  {collection.isMine && (
                    <button
                      type="button"
                      aria-label={t('collection.remove')}
                      onClick={() => void removeArtist(artist.id)}
                      className="rounded-full p-2 text-secondary-text hover:bg-secondary-bg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {!collection.isMine && user && (
          <>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="mt-10 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-500/10"
            >
              <Flag className="h-3.5 w-3.5 fill-current" /> {t('collection.report')}
            </button>
            <ReportDialog
              target={{ kind: 'collection', id: collection.id }}
              name={ownerName}
              blockUserId={collection.owner.id}
              open={reportOpen}
              onOpenChange={setReportOpen}
            />
          </>
        )}
      </div>
    </main>
  )
}

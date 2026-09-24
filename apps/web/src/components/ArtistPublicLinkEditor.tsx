import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clipboard, ExternalLink, Link2, Loader2, XCircle } from 'lucide-react'
import {
  checkArtistSlugAvailability,
  slugify,
  updateMyArtistProfile,
  type ClaimedArtistProfile,
} from '@musimaps/shared'
import { toast } from 'sonner'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'error'

export function ArtistPublicLinkEditor({
  artist,
  onSaved,
}: {
  artist: ClaimedArtistProfile
  onSaved: (slug: string) => void
}) {
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const [draft, setDraft] = useState(artist.slug ?? '')
  const [availability, setAvailability] = useState<Availability>('idle')
  const [saving, setSaving] = useState(false)
  const slug = useMemo(() => slugify(draft), [draft])
  const isValid = slug.length >= 3
  const isCurrent = slug === (artist.slug ?? '')
  const relativeUrl = localize(`/artist/${artist.slug || artist.id}`)
  const previewUrl = `https://musimaps.com${localize(`/artist/${slug || artist.slug || artist.id}`)}`

  useEffect(() => {
    if (!draft.trim() || !isValid || isCurrent) {
      setAvailability('idle')
      return
    }
    setAvailability('checking')
    let cancelled = false
    const timer = window.setTimeout(() => {
      void checkArtistSlugAvailability(slug, artist.id).then((result) => {
        if (cancelled) return
        if (result.error) setAvailability('error')
        else setAvailability(result.available ? 'available' : 'taken')
      })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [artist.id, draft, isCurrent, isValid, slug])

  const save = async () => {
    if (!isValid || availability === 'taken' || availability === 'checking') return
    setSaving(true)
    const check = await checkArtistSlugAvailability(slug, artist.id)
    if (!check.available) {
      setSaving(false)
      setAvailability(check.error ? 'error' : 'taken')
      return
    }
    const result = await updateMyArtistProfile({ slug })
    setSaving(false)
    if (!result.ok) {
      toast.error(t('dash.saveFailed'), { description: result.error })
      return
    }
    onSaved(slug)
    setDraft(slug)
    setAvailability('idle')
    toast.success(t('artistLink.saved'))
  }

  const availabilityLabel = !draft.trim()
    ? null
    : !isValid
      ? t('artistLink.invalid')
      : availability === 'checking'
        ? t('artistLink.checking')
        : availability === 'available'
          ? t('artistLink.available')
          : availability === 'taken'
            ? t('artistLink.taken')
            : null

  return (
    <div className="border-t border-hairline px-5 py-5 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-deep">
          <Link2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">{t('artistLink.title')}</h3>
          <p className="mt-1 text-sm leading-relaxed text-secondary-text">{t('artistLink.description')}</p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">{t('artistLink.label')}</span>
        <div className={`flex overflow-hidden rounded-2xl border bg-warm-white transition-colors focus-within:ring-2 focus-within:ring-brand-deep ${availability === 'taken' ? 'border-red-400' : availability === 'available' ? 'border-green-500' : 'border-hairline-strong'}`}>
          <span className="hidden items-center border-r border-hairline px-4 text-sm text-secondary-text sm:flex">musimaps.com/artist/</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={slugify(artist.name) || artist.id}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none"
          />
          <span className="flex w-10 items-center justify-center" aria-hidden="true">
            {availability === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-secondary-text" />}
            {availability === 'available' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {availability === 'taken' && <XCircle className="h-4 w-4 text-red-600" />}
          </span>
        </div>
      </label>
      <div className="mt-2 min-h-5 text-xs">
        {availabilityLabel && (
          <p className={availability === 'available' ? 'text-green-700 dark:text-green-300' : availability === 'taken' || !isValid ? 'text-red-600' : 'text-secondary-text'}>
            {availabilityLabel}
          </p>
        )}
        {!availabilityLabel && <p className="break-all text-secondary-text">{previewUrl}</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !isValid || isCurrent || availability === 'taken' || availability === 'checking'}
          className="inline-flex items-center gap-2 rounded-full bg-brand-deep px-5 py-2.5 text-sm font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('artistLink.save')}
        </button>
        <a
          href={relativeUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-hairline-strong px-4 py-2.5 text-sm font-semibold hover:bg-secondary-bg"
        >
          <ExternalLink className="h-4 w-4" /> {t('artistLink.open')}
        </a>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(`https://musimaps.com${relativeUrl}`).then(() => toast.success(t('artistLink.copied')))}
          className="inline-flex items-center gap-2 rounded-full border border-hairline-strong px-4 py-2.5 text-sm font-semibold hover:bg-secondary-bg"
        >
          <Clipboard className="h-4 w-4" /> {t('artistLink.copy')}
        </button>
      </div>
    </div>
  )
}

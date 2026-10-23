import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, Globe2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchMyPublicSettings,
  HANDLE_MAX,
  normalizeHandle,
  PROFILE_BIO_MAX,
  profilePath,
  setPublicProfile,
  suggestHandle,
  updateProfile,
} from '@musimaps/shared'
import { useLanguage, useLocalizedPath } from '../../i18n/LanguageContext'
import { Switch } from '../ui/switch'

/**
 * Profil public au choix : interrupteur, @identifiant et bio — même réglage
 * que `PublicProfileSettings` côté mobile. Privé par défaut (00080).
 */
export function PublicProfileSettings({ displayName }: { displayName: string }) {
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const [loaded, setLoaded] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [savedHandle, setSavedHandle] = useState<string | null>(null)
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const section = useRef<HTMLElement>(null)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    void fetchMyPublicSettings().then((settings) => {
      if (cancelled) return
      setIsPublic(settings?.isPublic ?? false)
      setSavedHandle(settings?.handle ?? null)
      setHandle(settings?.handle ?? '')
      setBio(settings?.bio ?? '')
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Lien « Rendre mon profil public » depuis la communauté : la section arrive après chargement.
  useEffect(() => {
    if (loaded && location.hash === '#public-profile') section.current?.scrollIntoView({ block: 'start' })
  }, [loaded, location.hash])

  // Identifiant proposé à partir du nom tant que la personne n'en a pas choisi.
  useEffect(() => {
    if (loaded && !handle && !savedHandle) setHandle(suggestHandle(displayName))
  }, [loaded, handle, savedHandle, displayName])

  const save = async () => {
    setError(null)
    setBusy(true)
    const result = await setPublicProfile(isPublic, handle)
    if (!result.ok) {
      setBusy(false)
      setError(result.error === 'handle_taken' ? t('community.handleTaken') : t('community.handleInvalid'))
      return
    }
    const bioResult = await updateProfile({ bio })
    setBusy(false)
    if (bioResult.error) return setError(t('community.error'))
    if (isPublic) setSavedHandle(normalizeHandle(handle))
    toast.success(t('community.saved'))
  }

  if (!loaded) return null

  return (
    <section ref={section} id="public-profile" className="mt-8 scroll-mt-28 rounded-3xl border border-hairline bg-secondary-bg p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <Globe2 className="h-4 w-4 text-brand-deep dark:text-brand" /> {t('community.publicProfile')}
          </h2>
          <p className="mt-1 text-sm text-secondary-text">{t('community.publicProfileHint')}</p>
        </div>
        <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label={t('community.publicProfile')} />
      </div>

      {isPublic && (
        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t('community.handle')}</span>
            <span className="flex items-center rounded-2xl border border-hairline-strong bg-warm-white px-4 focus-within:ring-2 focus-within:ring-brand-deep">
              <span className="text-secondary-text">@</span>
              <input
                value={handle}
                maxLength={HANDLE_MAX}
                onChange={(event) => setHandle(normalizeHandle(event.target.value))}
                autoCapitalize="none"
                className="w-full bg-transparent py-3.5 pl-1 outline-none"
              />
            </span>
            <span className="mt-1 block text-xs text-secondary-text">{t('community.handleHint')}</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t('pedit.bioLabel')}</span>
            <textarea
              value={bio}
              maxLength={PROFILE_BIO_MAX}
              rows={3}
              onChange={(event) => setBio(event.target.value)}
              className="w-full resize-none rounded-2xl border border-hairline-strong bg-warm-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand-deep"
            />
          </label>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="flex items-center gap-2 rounded-full bg-brand-deep px-6 py-3 text-sm font-bold text-brand-deep-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t('collection.save')}
        </button>
        {savedHandle && (
          <Link to={localize(profilePath(savedHandle))} className="text-sm font-semibold text-brand-deep hover:underline dark:text-brand">
            {t('community.viewMyProfile')}
          </Link>
        )}
      </div>
    </section>
  )
}

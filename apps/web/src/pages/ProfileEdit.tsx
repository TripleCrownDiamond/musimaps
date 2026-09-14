import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Camera, Check, ImagePlus, Loader2, LocateFixed, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { AccountAvatar, AccountCover } from '../components/AccountMedia'
import { PROFILE_MEDIA, deleteAccount, uploadProfileImage } from '@musimaps/shared'
import { LocationSelect, type LocationValue } from '../components/LocationSelect'
import { SecondaryPageHeader } from '../components/SecondaryPageHeader'
import { NeighborhoodSelect } from '../components/NeighborhoodSelect'
import { reverseGeocodeBrowser } from '../lib/geolocate'

/**
 * Complétion / modification du PROFIL DE COMPTE (table profiles) :
 * nom, ville, genres favoris, avatar et cover. C'est volontairement distinct
 * de la page /artistes (ArtistSignup) qui, elle, sert à rejoindre la
 * liste d'attente / demander le référencement sur la carte.
 */
export default function ProfileEdit() {
  const { user, loading, updateProfile, signOut } = useAuth()
  const { t, lang } = useLanguage()
  const localize = useLocalizedPath()
  const navigate = useNavigate()
  const location = useLocation()
  const deletionSection = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user && location.hash === '#delete-account') deletionSection.current?.scrollIntoView({ block: 'center' })
  }, [user, location.hash])

  const [displayName, setDisplayName] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [district, setDistrict] = useState('')
  const [genres, setGenres] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Affichée dans la carte photo/cover : l'erreur du formulaire vit sous les
  // champs, hors de vue quand on vient de choisir une image.
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [locating, setLocating] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  // Pré-remplissage à la première arrivée du profil uniquement : un champ
  // vidé par l'utilisateur ne doit jamais être ré-rempli par un refresh.
  const hydrated = useRef(false)

  useEffect(() => {
    if (!user || hydrated.current) return
    hydrated.current = true
    setDisplayName(user.displayName || '')
    setCity(user.city || '')
    setCountry(user.country || '')
    setDistrict(user.district || '')
    setGenres((user.favoriteGenres ?? []).join(', '))
    setAvatarUrl(user.avatarUrl)
    setCoverUrl(user.coverUrl)
  }, [user])

  const geolocate = async () => {
    setLocating(true)
    try {
      const result = await reverseGeocodeBrowser()
      if (result?.denied) return setError(t('auth.locationDenied'))
      if (!result || (!result.city && !result.countryCode)) return setError(t('auth.locationNotFound'))
      if (result.city) setCity(result.city)
      if (result.countryCode) setCountry(result.countryCode)
    } catch {
      setError(t('auth.locationNotFound'))
    } finally {
      setLocating(false)
    }
  }

  // Progression de complétion affichée sous le formulaire.
  const completion = useMemo(() => {
    const steps = [displayName.trim(), city.trim()]
    return Math.round((steps.filter(Boolean).length / steps.length) * 100)
  }, [displayName, city])

  if (!loading && !user) return <Navigate to={localize('/login')} state={{ from: location.pathname + location.hash }} replace />

  const pickImage = async (file: File | undefined, kind: 'avatar' | 'cover') => {
    if (!file) return
    setUploading(true)
    setMediaError(null)
    const result = await uploadProfileImage(file, kind)
    if (result.error) {
      setUploading(false)
      setMediaError(result.error)
      return
    }

    // Persiste la photo dès l'upload : elle est immédiatement disponible sur
    // mobile et ne dépend pas d'un clic ultérieur sur « Enregistrer ».
    const { error: syncError } = await updateProfile(
      kind === 'avatar' ? { avatarUrl: result.url } : { coverUrl: result.url },
    )
    setUploading(false)
    if (syncError) {
      setMediaError(syncError.message)
      return
    }
    if (kind === 'avatar') {
      setAvatarUrl(result.url)
    } else {
      setCoverUrl(result.url)
    }
  }

  const removeImage = async (kind: 'avatar' | 'cover') => {
    setUploading(true)
    setMediaError(null)
    const { error: err } = await updateProfile(kind === 'avatar' ? { avatarUrl: null } : { coverUrl: null })
    setUploading(false)
    if (err) {
      setMediaError(err.message)
      return
    }
    if (kind === 'avatar') {
      setAvatarUrl(null)
    } else {
      setCoverUrl(null)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return setError(t('pedit.errName'))
    if (!city.trim()) return setError(t('pedit.errCity'))
    if (!country.trim()) return setError(t('auth.missingCountry'))
    setError(null)
    setBusy(true)
    const { error: err } = await updateProfile({
      displayName,
      city,
      country,
      district,
      favoriteGenres: genres.split(',').map((g) => g.trim()).filter(Boolean),
      avatarUrl,
      coverUrl,
    })
    setBusy(false)
    if (err) return setError(err.message)
    setSaved(true)
    setTimeout(() => navigate(localize('/dashboard')), 900)
  }

  const field =
    'w-full rounded-2xl border border-hairline-strong bg-warm-white px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-deep'

  return (
    <div className="min-h-screen bg-warm-white px-5 pt-36 pb-24 sm:px-6 md:px-12 md:pt-44">
      <div className="mx-auto w-full max-w-2xl">
        <SecondaryPageHeader
          onBack={() => (window.history.length > 1 ? navigate(-1) : navigate(localize('/dashboard')))}
          backLabel={t('common.back')}
        />

        <div className="rounded-[2rem] border border-hairline bg-surface p-4 shadow-xl sm:p-8">
          <p className="text-xs font-bold tracking-[0.2em] text-brand-deep uppercase">{t('pedit.kicker')}</p>
          <h1 className="display-font mt-1.5 text-3xl font-bold">{t('profile.editProfile')}</h1>
          <p className="mt-1.5 mb-7 text-sm text-secondary-text">{t('pedit.subtitle')}</p>

          {/* Visuels du compte : cover + avatar, partagés avec le profil mobile. */}
          <div className="mb-7 overflow-hidden rounded-3xl border border-hairline bg-secondary-bg">
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void pickImage(e.target.files?.[0], 'cover')
                e.target.value = ''
              }}
            />
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void pickImage(e.target.files?.[0], 'avatar')
                e.target.value = ''
              }}
            />
            <AccountCover image={coverUrl}>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 to-transparent px-4 pb-3 pt-10">
                <div className="min-w-0 text-white">
                  <p className="text-sm font-bold">{t('profile.coverTitle')}</p>
                  <p className="line-clamp-2 text-xs text-white/75">{t('profile.coverHint')}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {coverUrl && (
                    <button
                      type="button"
                      onClick={() => void removeImage('cover')}
                      disabled={uploading}
                      style={{ width: PROFILE_MEDIA.actionSize, height: PROFILE_MEDIA.actionSize }}
                      className="flex items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-red-600/80 disabled:opacity-60"
                      aria-label={t('profile.removeCover')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => coverInput.current?.click()}
                    disabled={uploading}
                    style={{ minWidth: PROFILE_MEDIA.actionSize, minHeight: PROFILE_MEDIA.actionSize }}
                    className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-black/80 disabled:opacity-60"
                    aria-label={t('profile.uploadCover')}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    <span className="hidden sm:inline">{t('profile.uploadCover')}</span>
                  </button>
                </div>
              </div>
            </AccountCover>
            <div className="flex items-center gap-4 p-4 sm:p-5">
              <div className="relative shrink-0">
                <AccountAvatar
                  name={displayName || 'M'}
                  image={avatarUrl}
                  variant="edit"
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  style={{ width: PROFILE_MEDIA.actionSize, height: PROFILE_MEDIA.actionSize }}
                  className="absolute -right-1 -bottom-1 flex items-center justify-center rounded-full bg-brand-deep text-brand-deep-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-60"
                  aria-label={t('profile.uploadAvatar')}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
              </div>
              <div className="min-w-0 flex-1 text-sm text-secondary-text">
                <p className="font-medium text-primary-text">{t('profile.avatarTitle')}</p>
                <p className="line-clamp-2">{t('profile.avatarHint')}</p>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => void removeImage('avatar')}
                    disabled={uploading}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t('profile.removeAvatar')}
                  </button>
                )}
              </div>
            </div>
            {mediaError && (
              <p role="alert" className="px-4 pb-4 text-sm font-medium text-red-600 sm:px-5 sm:pb-5">
                {mediaError}
              </p>
            )}
          </div>

          <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('pedit.nameLabel')}</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('pedit.namePh')}
                autoComplete="name"
                className={field}
              />
            </label>
            <div className="block">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="block text-sm font-medium">{t('auth.location')} *</span>
                <button
                  type="button"
                  onClick={() => void geolocate()}
                  disabled={locating}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-deep transition-colors hover:text-brand-deep/80 disabled:opacity-60 dark:text-brand"
                >
                  {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                  {t('auth.geolocate')}
                </button>
              </div>
              <LocationSelect
                lang={lang}
                value={{ city, country, flag: '', lat: 0, lng: 0, continent: '' }}
                onChange={(location: LocationValue) => {
                  setCity(location.city)
                  setCountry(location.country)
                }}
              />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('pedit.districtLabel')}</span>
              <NeighborhoodSelect
                value={district}
                placeholder={t('pedit.districtPlaceholder')}
                onChange={(value, suggestion) => {
                  setDistrict(value)
                  if (suggestion?.city) setCity(suggestion.city)
                  if (suggestion?.countryCode) setCountry(suggestion.countryCode)
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('pedit.genresLabel')}</span>
              <input
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                placeholder={t('pedit.genresPlaceholder')}
                className={field}
              />
            </label>

            {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy || uploading}
              className="mt-2 flex items-center justify-center gap-2 rounded-full bg-brand-deep px-8 py-3.5 font-medium text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {busy || uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : null}
              {saved ? t('pedit.saved') : t('pedit.saveEdit')}
            </button>
          </form>

          {/* Suppression de compte */}
          <div id="delete-account" ref={deletionSection} className="mt-8 scroll-mt-32 border-t border-hairline pt-6">
            <h3 className="text-sm font-bold text-red-600">{t('account.deleteTitle')}</h3>
            <p className="mt-1 text-xs text-secondary-text">{t('account.deleteMessage')}</p>
            <button
              type="button"
              onClick={async () => {
                if (!user) return
                const ok = window.confirm(t('account.deleteTitle'))
                if (!ok) return
                const res = await deleteAccount(user.email)
                if (res.ok) {
                  await signOut()
                  navigate(localize('/'))
                } else {
                  alert(res.error ?? 'Erreur')
                }
              }}
              className="mt-3 flex items-center gap-2 rounded-full border border-red-300 px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> {t('account.deleteBtn')}
            </button>
          </div>

          {/* Progression de complétion */}
          <div className="mt-6 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-hairline-strong">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-deep to-brand transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
            <span className="text-xs font-bold">{completion}%</span>
          </div>
          <p className="mt-2 text-xs text-secondary-text">{t('pedit.completionHint')}</p>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Check, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { uploadArtistPhoto } from '../lib/waitlist'
import { AnimatedAvatar } from '../components/AnimatedAvatar'

/**
 * Complétion / modification du PROFIL DE COMPTE (table profiles) :
 * nom, ville, genres favoris, avatar. C'est volontairement distinct
 * de la page /artistes (ArtistSignup) qui, elle, sert à rejoindre la
 * liste d'attente / demander le référencement sur la carte.
 */
export default function ProfileEdit() {
  const { user, loading, updateProfile } = useAuth()
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [genres, setGenres] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  // Pré-remplissage à la première arrivée du profil uniquement : un champ
  // vidé par l'utilisateur ne doit jamais être ré-rempli par un refresh.
  const hydrated = useRef(false)

  useEffect(() => {
    if (!user || hydrated.current) return
    hydrated.current = true
    setDisplayName(user.displayName || '')
    setCity(user.city || '')
    setDistrict(user.district || '')
    setGenres((user.favoriteGenres ?? []).join(', '))
    setAvatarUrl(user.avatarUrl)
  }, [user])

  // Progression de complétion affichée sous le formulaire.
  const completion = useMemo(() => {
    const steps = [displayName.trim(), city.trim()]
    return Math.round((steps.filter(Boolean).length / steps.length) * 100)
  }, [displayName, city])

  if (!loading && !user) return <Navigate to={localize('/login')} replace />

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setError(null)
    const result = await uploadArtistPhoto(file)
    setUploading(false)
    if (result.error) setError(result.error)
    else {
      setImgError(false)
      setAvatarUrl(result.url)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return setError(t('pedit.errName'))
    if (!city.trim()) return setError(t('pedit.errCity'))
    setError(null)
    setBusy(true)
    const { error: err } = await updateProfile({
      displayName,
      city,
      district,
      favoriteGenres: genres.split(',').map((g) => g.trim()).filter(Boolean),
      avatarUrl,
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
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(localize('/dashboard')))}
          className="mb-6 flex items-center gap-2 rounded-full border border-hairline-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary-bg"
        >
          <ArrowLeft className="h-4 w-4" /> {t('common.back')}
        </button>

        <div className="rounded-[2rem] border border-hairline bg-surface p-8 shadow-xl">
          <p className="text-xs font-bold tracking-[0.2em] text-brand-deep uppercase">{t('pedit.kicker')}</p>
          <h1 className="display-font mt-1.5 text-3xl font-bold">{t('profile.editProfile')}</h1>
          <p className="mt-1.5 mb-7 text-sm text-secondary-text">{t('pedit.subtitle')}</p>

          {/* Avatar du compte */}
          <div className="mb-7 flex items-center gap-4">
            <div className="relative">
              <AnimatedAvatar
                name={displayName || 'M'}
                image={imgError ? null : avatarUrl}
                className="h-20 w-20 rounded-full border border-hairline-strong"
                initialsClassName="bg-brand text-2xl font-bold text-black"
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="absolute -right-1 -bottom-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-deep text-brand-deep-foreground shadow-lg transition-transform hover:scale-105 disabled:opacity-60"
                aria-label={t('profile.uploadAvatar')}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>
            <div className="text-sm text-secondary-text">
              <p className="font-medium text-primary-text">{t('profile.avatarTitle')}</p>
              <p>{t('profile.avatarHint')}</p>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void pickPhoto(e.target.files?.[0])
                e.target.value = ''
              }}
            />
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
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('pedit.cityLabel')}</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Cotonou, Bénin"
                autoComplete="address-level2"
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('pedit.districtLabel')}</span>
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Ex. Yopougon, Bastille, Almadies…"
                autoComplete="address-line1"
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('pedit.genresLabel')}</span>
              <input
                value={genres}
                onChange={(e) => setGenres(e.target.value)}
                placeholder="Afrobeats, Soul, Rap"
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

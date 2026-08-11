import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Camera, Globe2, ImagePlus, Link2, Loader2, Mic2, Radar, Users } from 'lucide-react'
import PulseDots from '../components/PulseDots'
import Footer from '../components/Footer'
import RichText from '../components/RichText'
import { isValidEmail, saveSignup, uploadArtistPhoto } from '../lib/waitlist'
import { fetchMyArtistProfile, updateMyArtistProfile } from '../lib/profile'
import { LocationSelect, type LocationValue } from '../components/LocationSelect'
import { useAuth } from '../context/AuthContext'
import { useCms } from '../context/CmsContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'

const perkIcons = [Radar, Users, Globe2]

interface FormState {
  artistName: string
  email: string
  city: string
  district: string
  country: string
  lat: number
  lng: number
  genre: string
  bio: string
  platform: string
  platformUrl: string
  social: string
  socialUrl: string
  photo: string
}

export default function ArtistSignup() {
  const navigate = useNavigate()
  const location = useLocation()
  const localize = useLocalizedPath()
  const { t } = useLanguage()
  const { content } = useCms()
  const page = content.artistSignup
  const fileInput = useRef<HTMLInputElement>(null)

  const { user, loading, updateProfile } = useAuth()
  const prefillEmail = (location.state as { email?: string } | null)?.email ?? ''
  // Pré-remplissage : si l'utilisateur est connecté, son nom / ville / email
  // alimentent le formulaire (le bouton « Modifier profil » du dashboard
  // artiste mène ici). Sinon on reprend l'état passé à la navigation.
  const [form, setForm] = useState<FormState>({
    artistName: user?.displayName ?? '',
    email: user?.email ?? prefillEmail,
    city: user?.city ?? '',
    district: user?.district ?? '',
    country: '',
    lat: 0,
    lng: 0,
    genre: '',
    bio: '',
    platform: 'spotify',
    platformUrl: '',
    social: 'instagram',
    socialUrl: '',
    photo: '',
  })

  // Le profil du compte arrive de façon asynchrone : re-synchronise le formulaire
  // (nom, email, ville) puis charge le profil de la carte revendiqué, s'il
  // existe, pour pré-remplir aussi bio, genre, photo et liens.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setForm((f) => ({
      ...f,
      artistName: f.artistName || user.displayName || '',
      email: user.email || f.email,
      city: f.city || user.city || '',
    }))
    void fetchMyArtistProfile().then((claimed) => {
      if (cancelled || !claimed) return
      setForm((f) => ({
        ...f,
        genre: f.genre || claimed.genre || '',
        bio: f.bio || claimed.bio || '',
        photo: f.photo || claimed.image || '',
        platformUrl: f.platformUrl || claimed.platforms?.spotify || claimed.platforms?.youtube || '',
        platform: claimed.platforms?.spotify ? 'spotify' : claimed.platforms?.youtube ? 'youtube' : f.platform,
        socialUrl: f.socialUrl || claimed.socials?.instagram || '',
      }))
    })
    return () => {
      cancelled = true
    }
  }, [user])
  const setPlatform = (v: string) => setForm((f) => ({ ...f, platform: v }))
  const setPlatformUrl = (v: string) => setForm((f) => ({ ...f, platformUrl: v }))
  const setSocial = (v: string) => setForm((f) => ({ ...f, social: v }))
  const setSocialUrl = (v: string) => setForm((f) => ({ ...f, socialUrl: v }))
  const platformLabel = form.platform === 'apple_music' ? 'Apple Music' : form.platform === 'youtube' ? 'YouTube Music' : form.platform.charAt(0).toUpperCase() + form.platform.slice(1)
  const socialLabel = form.social === 'twitter' ? 'X' : form.social.charAt(0).toUpperCase() + form.social.slice(1)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sent, setSent] = useState(false)

  const update =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const result = await uploadArtistPhoto(file)
    setUploading(false)
    if (result.error) setError(result.error)
    else setForm((f) => ({ ...f, photo: result.url }))
    e.target.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.artistName.trim()) return setError('Indiquez votre nom d’artiste.')
    if (!isValidEmail(form.email)) return setError('Cette adresse email est invalide.')
    if (!form.city.trim()) return setError('Indiquez la ville depuis laquelle vous créez.')
    setError(null)
    await saveSignup(
      {
        email: form.email.trim(),
        profile: 'artiste',
        artistName: form.artistName.trim(),
        city: form.city.trim(),
        district: form.district.trim() || undefined,
        genre: form.genre.trim(),
        bio: form.bio.trim(),
        photo: form.photo || undefined,
        spotify: form.platform === 'spotify' ? form.platformUrl.trim() || undefined : undefined,
        youtube: form.platform === 'youtube' ? form.platformUrl.trim() || undefined : undefined,
        instagram: form.social === 'instagram' ? form.socialUrl.trim() || undefined : undefined,
        link: form.platformUrl.trim() || form.socialUrl.trim() || undefined,
      },
      { userId: user?.id },
    )
    // Utilisateur connecté : la photo devient aussi l'avatar du compte
    // (navbar, dashboard) — pas seulement une entrée de waitlist.
    if (user && form.photo) {
      await updateProfile({ avatarUrl: form.photo })
    }
    // Utilisateur connecté : on rattache aussi les données au profil de la
    // carte revendiqué (best-effort, ignoré s'il n'a pas encore de pin).
    if (user) {
      await updateMyArtistProfile({
        bio: form.bio.trim() || undefined,
        genre: form.genre.trim() || undefined,
        image: form.photo || undefined,
        platforms:
          form.platformUrl.trim() && form.platform === 'spotify'
            ? { spotify: form.platformUrl.trim() }
            : form.platformUrl.trim() && form.platform === 'youtube'
              ? { youtube: form.platformUrl.trim() }
              : undefined,
        socials:
          form.socialUrl.trim() && form.social === 'instagram'
            ? { instagram: form.socialUrl.trim() }
            : undefined,
      })
    }
    setSent(true)
  }

  const createAccount = () =>
    navigate(localize('/signup'), {
      state: {
        role: 'artist',
        email: form.email.trim(),
        displayName: form.artistName.trim(),
        city: form.city.trim(),
        country: form.country,
      },
    })

  const field =
    'w-full rounded-2xl border border-hairline-strong px-6 py-4 outline-none focus:ring-2 focus:ring-brand-deep'

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col bg-warm-white">
        <main className="relative flex-1 overflow-hidden pb-16 pt-44">
          <div className="map-bg absolute inset-0 z-0 opacity-40" />
          <PulseDots
            positions={[
              { top: '20%', left: '25%' },
              { top: '40%', left: '75%' },
              { top: '70%', left: '15%' },
            ]}
          />
          <div className="relative z-20 mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-6 text-center">
            <div className="fade-in-up space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand-deep">
                <Mic2 className="h-4 w-4" /> Demande enregistrée
              </span>
              <h1 className="display-font text-5xl font-extrabold md:text-6xl">
                Votre place sur la carte est réservée.
              </h1>
              {user && !loading ? (
                <p className="mx-auto max-w-xl text-lg text-secondary-text">
                  Votre demande de référencement pour <strong>{form.artistName}</strong> est bien
                  enregistrée et rattachée à votre compte. Elle est{' '}
                  <strong>en attente de validation</strong> : vous la retrouverez dans votre
                  tableau de bord et recevrez votre place sur la carte dès qu’elle sera validée.
                </p>
              ) : loading ? (
                <p className="mx-auto max-w-xl text-lg text-secondary-text">{t('common.loading')}</p>
              ) : (
                <p className="mx-auto max-w-xl text-lg text-secondary-text">
                  Votre demande de référencement pour <strong>{form.artistName}</strong> est bien
                  enregistrée. Créez maintenant votre compte pour préparer votre profil et recevoir
                  vos premières demandes.
                </p>
              )}
            </div>

            <div className="fade-in-up w-full space-y-4" style={{ animationDelay: '0.15s' }}>
              {user && !loading ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(localize('/dashboard'))}
                    className="w-full rounded-full bg-brand-deep py-5 text-lg font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
                  >
                    Voir mon profil
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(localize('/globe'))}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline-strong px-6 py-4 font-medium transition-colors hover:bg-secondary-bg"
                  >
                    <Globe2 className="h-5 w-5" /> {t('confirm.explore')}
                  </button>
                </>
              ) : loading ? (
                <p className="text-sm text-secondary-text">{t('common.loading')}</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={createAccount}
                    className="w-full rounded-full bg-brand-deep py-5 text-lg font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
                  >
                    Créer mon compte artiste
                  </button>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => navigate(localize('/globe'))}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full border border-hairline-strong px-6 py-4 font-medium transition-colors hover:bg-secondary-bg"
                    >
                      <Globe2 className="h-5 w-5" /> {t('confirm.explore')}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(localize('/login'))}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full border border-hairline-strong px-6 py-4 font-medium transition-colors hover:bg-secondary-bg"
                    >
                      J’ai déjà un compte
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-warm-white">
      <main className="relative flex-1 overflow-hidden pb-16 pt-44">
        <div className="map-bg absolute inset-0 z-0 opacity-40" />
        <PulseDots
          positions={[
            { top: '20%', left: '25%' },
            { top: '40%', left: '75%' },
            { top: '70%', left: '15%' },
            { top: '15%', left: '60%' },
          ]}
        />

        <div className="relative z-20 mx-auto flex w-full max-w-5xl flex-col items-center gap-12 px-6">
          <div className="fade-in-up space-y-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand-deep">
              <Mic2 className="h-4 w-4" /> {page.badge}
            </span>
            <h1 className="display-font text-5xl font-extrabold md:text-7xl">
              {page.title}
            </h1>
            <RichText
              content={page.subtitle}
              className="mx-auto max-w-xl text-xl text-secondary-text"
            />
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="floating-card fade-in-up w-full max-w-2xl space-y-4 rounded-[2.5rem] p-8 md:p-10"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Nom d’artiste *</span>
                <input value={form.artistName} onChange={update('artistName')} className={field} placeholder="Votre nom de scène" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Email *</span>
                <input type="email" value={form.email} onChange={update('email')} className={field} placeholder="vous@email.com" />
              </label>
            </div>
            <div className="block">
              <span className="mb-2 block text-sm font-medium">Ville *</span>
              <LocationSelect
                value={{
                  city: form.city,
                  country: form.country,
                  flag: '',
                  lat: form.lat,
                  lng: form.lng,
                  continent: '',
                }}
                onChange={(loc: LocationValue) =>
                  setForm((f) => ({
                    ...f,
                    city: loc.city,
                    country: loc.country,
                    lat: loc.lat,
                    lng: loc.lng,
                  }))
                }
              />
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Quartier / district</span>
              <input value={form.district} onChange={update('district')} className={field} placeholder="Ex. Yopougon, Bastille, Almadies…" />
              <span className="mt-1 block text-xs text-secondary-text">
                Optionnel — ancre votre pin dans le bon quartier au lieu du centre-ville.
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Genre musical</span>
              <input value={form.genre} onChange={update('genre')} className={field} placeholder="Afro-Soul" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Bio</span>
              <textarea
                value={form.bio}
                onChange={update('bio')}
                rows={4}
                className={`${field} resize-none`}
                placeholder="Parlez de votre univers, de votre parcours, de ce qui rend votre musique unique…"
              />
            </label>

            {/* Photo de profil */}
            <div className="block">
              <span className="mb-2 block text-sm font-medium">Photo</span>
              <div className="flex items-center gap-4">
                {form.photo ? (
                  <img
                    src={form.photo}
                    alt="Aperçu"
                    className="h-20 w-20 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary-bg text-secondary-text">
                    <Camera className="h-7 w-7" />
                  </span>
                )}
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => void handlePhoto(e)} />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 rounded-full border border-hairline-strong px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary-bg disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {form.photo ? 'Changer la photo' : 'Ajouter une photo'}
                  </button>
                  {form.photo && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, photo: '' }))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Retirer la photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Liens — 1 plateforme + 1 réseau social (Premium = illimité) */}
            <div className="space-y-4 rounded-3xl border border-hairline bg-secondary-bg/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  <Link2 className="h-4 w-4 text-brand-deep" /> Liens (offre découverte)
                </span>
                <span className="rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-black">
                  1 plateforme · 1 réseau
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Plateforme d'écoute *</span>
                  <select
                    value={form.platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className={`${field} select-chevron appearance-none`}
                  >
                    <option value="spotify">Spotify</option>
                    <option value="youtube">YouTube Music</option>
                    <option value="apple_music">Apple Music</option>
                    <option value="deezer">Deezer</option>
                    <option value="soundcloud">SoundCloud</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Lien {platformLabel}</span>
                  <input value={form.platformUrl} onChange={(e) => setPlatformUrl(e.target.value)} className={field} placeholder="https://…" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Réseau social *</span>
                  <select
                    value={form.social}
                    onChange={(e) => setSocial(e.target.value)}
                    className={`${field} select-chevron appearance-none`}
                  >
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="twitter">X (Twitter)</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Lien {socialLabel}</span>
                  <input value={form.socialUrl} onChange={(e) => setSocialUrl(e.target.value)} className={field} placeholder="https://…" />
                </label>
              </div>
              <p className="text-xs text-secondary-text">
                Passez en <strong>Premium</strong> pour ajouter plusieurs plateformes, réseaux et un
                lien site. Il reste des places limitées au lancement.
              </p>
            </div>

            {error && (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-brand-deep py-5 text-lg font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {loading ? t('common.loading') : page.ctaLabel}
            </button>
            <RichText content={page.privacyNote} className="text-center text-xs text-secondary-text" />
          </form>

          <div className="fade-in-up grid w-full grid-cols-1 gap-4 md:grid-cols-3" style={{ animationDelay: '0.4s' }}>
            {page.perks.map((perk, index) => {
              const Icon = perkIcons[index % perkIcons.length]
              return (
                <div key={perk.title} className="space-y-2 rounded-3xl border border-hairline bg-surface p-6">
                  <Icon className="h-6 w-6 text-brand-deep" />
                  <h2 className="display-font text-lg font-bold">{perk.title}</h2>
                  <RichText content={perk.text} className="text-sm text-secondary-text" />
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

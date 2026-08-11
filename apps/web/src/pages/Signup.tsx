import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarHeart, Eye, EyeOff, Headphones, Loader2, LocateFixed, MailCheck, MicVocal, Music, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useCms } from '../context/CmsContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import type { AccountRole } from '../lib/auth'
import { countryByCode, countryByName } from '@musimaps/shared'
import { LocationSelect, type LocationValue } from '../components/LocationSelect'
import { PasswordGauge } from '../components/PasswordGauge'
import { reverseGeocodeBrowser } from '../lib/discovery'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

interface SignupPrefill {
  role?: AccountRole
  email?: string
  displayName?: string
  city?: string
  country?: string
}

export default function Signup() {
  const { user, signUp, updateProfile } = useAuth()
  const { t, lang } = useLanguage()
  const { content } = useCms()
  const localize = useLocalizedPath()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // Liens d'invitation (waitlist → compte après lancement) : ?email=&role=
  // pré-remplissent le formulaire quand on n'arrive pas via location.state.
  const inviteEmail = searchParams.get('email') ?? ''
  const inviteRole = searchParams.get('role')
  const prefill: SignupPrefill = {
    ...((location.state ?? {}) as SignupPrefill),
    email: (location.state as SignupPrefill | null)?.email ?? inviteEmail,
    role: (location.state as SignupPrefill | null)?.role ?? (inviteRole === 'artist' ? 'artist' : inviteRole === 'melomane' ? 'melomane' : undefined),
  }

  // Édition de profil : quand l'utilisateur est déjà connecté, la page
  // affiche un formulaire pré-rempli (nom, ville, email) qui met à jour
  // le compte au lieu de créer un nouveau.
  const editing = Boolean(user)
  const [role, setRole] = useState<AccountRole | null>(prefill.role ?? null)
  const [name, setName] = useState(user?.displayName ?? prefill.displayName ?? '')
  const [city, setCity] = useState(user?.city ?? prefill.city ?? '')
  const [country, setCountry] = useState(user?.country ?? prefill.country ?? '')
  const [email, setEmail] = useState(user?.email ?? prefill.email ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [genres, setGenres] = useState(user?.favoriteGenres?.join(', ') ?? '')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [locating, setLocating] = useState(false)

  // Les données du compte arrivent de façon asynchrone : on les re-synchronise.
  useEffect(() => {
    if (!user) return
    setName(user.displayName ?? '')
    setCity(user.city ?? '')
    setCountry(user.country ?? '')
    setEmail(user.email ?? '')
    setRole(user.role ?? null)
    setGenres((current) => (current.trim() ? current : (user.favoriteGenres ?? []).join(', ')))
  }, [user])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) {
      // Mode édition : pas de mot de passe, on met à jour le compte.
      if (!name.trim()) return toast.error(t('auth.missingName'))
      if (!city.trim()) return toast.error(t('auth.missingCity'))
      setBusy(true)
      const { error: updateError } = await updateProfile({
        displayName: name,
        city,
        // Ne pas écraser un pays existant par une valeur vide (comptes anciens).
        country: country.trim() ? country : undefined,
        favoriteGenres: genres.split(','),
      })
      setBusy(false)
      if (updateError) return toast.error(updateError.message)
      toast.success(t('dash.saved'))
      navigate(localize('/dashboard'), { replace: true })
      return
    }
    if (!role) return toast.error(t('auth.missingRole'))
    if (!name.trim()) return toast.error(t('auth.missingName'))
    if (!city.trim()) return toast.error(t('auth.missingCity'))
    if (!country.trim()) return toast.error(t('auth.missingCountry'))
    if (!EMAIL_RE.test(email.trim())) return toast.error(t('auth.invalidEmail'))
    if (password.length < 8) return toast.error(t('auth.passwordShort'))
    if (password !== confirm) return toast.error(t('auth.passwordMismatch'))
    setBusy(true)
    const result = await signUp({
      email,
      password,
      role,
      displayName: name,
      city,
      country,
    })
    setBusy(false)
    if (result.error) {
      toast.error(
        /already registered|already been registered/i.test(result.error.message)
          ? t('auth.emailTaken')
          : result.error.message,
      )
    } else if (result.needsConfirmation) {
      // Confirmation email requise : on affiche l'écran « vérifiez vos emails ».
      setSent(true)
    } else {
      toast.success(t('toast.welcomeBack'))
      navigate(localize('/dashboard'), { replace: true })
    }
  }

  const field =
    'w-full rounded-2xl border border-hairline-strong px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-deep'

  // « Me localiser » (comme le mobile) : géolocalisation navigateur → ville + pays.
  const geolocate = async () => {
    setLocating(true)
    try {
      const result = await reverseGeocodeBrowser()
      if (result?.denied) {
        toast.error(t('auth.locationDenied'))
        return
      }
      if (!result || (!result.city && !result.countryCode)) {
        toast.error(t('auth.locationNotFound'))
        return
      }
      if (result.city) setCity(result.city)
      if (result.countryCode) setCountry(result.countryCode)
      toast.success(t('auth.locationFilled'))
    } catch {
      toast.error(t('auth.locationNotFound'))
    } finally {
      setLocating(false)
    }
  }

  // Création de compte fermée avant le lancement : on affiche le message
  // « disponible après le lancement », sauf si l'utilisateur arrive via un
  // lien d'invitation (waitlist → compte, ?email=&role=) ou est connecté.
  const signupClosed = !content.settings.openSignup && !user && !prefill.email
  if (signupClosed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-warm-white px-6 pt-44 pb-24">
        <div className="w-full max-w-md">
          <div className="rounded-[2rem] border border-hairline bg-surface p-8 text-center shadow-xl">
            <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black">
              <CalendarHeart className="h-8 w-8" />
            </span>
            <h1 className="display-font text-3xl font-bold">
              {t('auth.signupLater')}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-secondary-text">
              {content.settings.closedSignupMessage}
            </p>
            <Link
              to={localize('/')}
              className="mt-8 block w-full rounded-full bg-brand-deep py-4 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
            >
              {t('auth.backHome')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const roles: { value: AccountRole; label: string; hint: string; icon: typeof MicVocal }[] = [
    // Micro chanteur avec fil (comme le mobile) pour l'artiste, casque pour le mélomane.
    { value: 'artist', label: t('auth.roleArtist'), hint: t('auth.roleArtistHint'), icon: MicVocal },
    { value: 'melomane', label: t('auth.roleMelomane'), hint: t('auth.roleMelomaneHint'), icon: Headphones },
  ]

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-warm-white px-6 pt-44 pb-24">
        <div className="w-full max-w-md">
          <div className="rounded-[2rem] border border-hairline bg-surface p-8 text-center shadow-xl">
            <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black">
              <MailCheck className="h-8 w-8" />
            </span>
            <h1 className="display-font text-3xl font-bold">{t('auth.checkEmail')}</h1>
            <p className="mt-3 text-sm leading-relaxed text-secondary-text">
              {t('auth.checkEmailText')}
            </p>
            <p className="mt-2 break-all text-sm font-medium">{email.trim()}</p>
            <Link
              to={localize('/login')}
              className="mt-8 block w-full rounded-full bg-brand-deep py-4 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
            >
              {t('auth.login')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-warm-white px-6 pt-44 pb-24">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-hairline bg-surface p-8 shadow-xl">
          <div className="mb-5 flex flex-col items-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black">
              <Music className="h-7 w-7" />
            </span>
            <h1 className="display-font text-3xl font-bold text-center">
              {editing ? t('dash.editProfile') : t('auth.signupTitle')}
            </h1>
            <p className="mt-1.5 text-sm text-secondary-text text-center">
              {editing ? t('dash.editProfileHint') : t('auth.signupSubtitle')}
            </p>
          </div>

          <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
            {!editing && (
              <div className="grid gap-3">
                <span className="text-sm font-medium">{t('auth.role')}</span>
                {roles.map(({ value, label, hint, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    aria-pressed={role === value}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                      role === value
                        ? 'border-brand-deep bg-brand-soft ring-2 ring-brand-deep dark:border-brand dark:ring-brand'
                        : 'border-hairline-strong hover:bg-secondary-bg'
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                        role === value
                          ? 'bg-brand text-black'
                          : 'bg-brand-soft text-brand-deep dark:bg-brand-soft dark:text-brand'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-semibold">{label}</span>
                      <span className="block text-xs text-secondary-text">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t('auth.name')}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Martin" className={field} />
              </label>
              <div className="block">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="block text-sm font-medium">
                    {t('auth.location')} <span className="text-secondary-text">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void geolocate()}
                    disabled={locating}
                    className="flex items-center gap-1.5 text-xs font-semibold text-brand-deep transition-colors hover:text-brand-deep/80 disabled:opacity-60 dark:text-brand dark:hover:text-brand/80"
                  >
                    {locating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LocateFixed className="h-3.5 w-3.5" />
                    )}
                    {t('auth.geolocate')}
                  </button>
                </div>
                <LocationSelect
                  lang={lang}
                  value={{
                    city,
                    // Pays hérités en nom complet (« France ») → code ISO pour l'affichage.
                    country: countryByCode(country)?.code ?? countryByName(country)?.code ?? country,
                    flag: '',
                    lat: 0,
                    lng: 0,
                    continent: '',
                  }}
                  onChange={(loc: LocationValue) => {
                    setCity(loc.city)
                    setCountry(loc.country)
                  }}
                />
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('auth.email')}</span>
              <input
                type="email"
                value={email}
                disabled={editing}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@email.com"
                autoComplete="email"
                className={`${field} ${editing ? 'cursor-not-allowed opacity-60' : ''}`}
              />
            </label>
            {editing && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t('auth.genres')}</span>
                <input
                  value={genres}
                  onChange={(e) => setGenres(e.target.value)}
                  placeholder="Afrobeats, Soul, Rap"
                  className={field}
                />
                <span className="mt-1 block text-xs text-secondary-text">{t('auth.genresHint')}</span>
              </label>
            )}
            {!editing && (() => {
              return (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">{t('auth.password')}</span>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="8 caractères min."
                        autoComplete="new-password"
                        className={`${field} pr-12`}
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-secondary-text hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <PasswordGauge password={password} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">{t('auth.passwordConfirm')}</span>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className={`${field} pr-12`}
                      />
                      <button
                        type="button"
                        aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                        onClick={() => setShowConfirm((v) => !v)}
                        className="text-secondary-text hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2 transition-colors"
                      >
                        {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </label>
                </div>
              )
            })()}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-deep py-4 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              {editing ? t('dash.saveProfile') : t('auth.signup')}
            </button>
          </form>

          {!editing && (
            <p className="mt-6 text-center text-sm text-secondary-text">
              {t('auth.haveAccount')}{' '}
              <Link to={localize('/login')} className="font-medium text-brand-deep hover:underline">
                {t('auth.loginLink')}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

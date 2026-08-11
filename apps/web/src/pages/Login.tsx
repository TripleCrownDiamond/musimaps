import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Headphones, Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate(localize('/dashboard'), { replace: true })
  }, [user, loading, navigate, localize])

  if (!loading && user) return <Navigate to={localize('/dashboard')} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) return toast.error(t('auth.invalidEmail'))
    if (!password) return toast.error(t('auth.password'))
    setBusy(true)
    const err = await signIn(email, password)
    setBusy(false)
    if (err) toast.error(t('auth.error'))
    else toast.success(t('toast.welcomeBack'))
  }

  const field =
    'w-full rounded-2xl border border-hairline-strong px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-deep'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-warm-white px-6 pt-44 pb-24">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-hairline bg-surface p-8 shadow-xl">
          <div className="mb-5 flex flex-col items-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black">
              <Headphones className="h-7 w-7" />
            </span>
            <h1 className="display-font text-3xl font-bold text-center">{t('auth.loginTitle')}</h1>
            <p className="mt-1.5 text-sm text-secondary-text text-center">{t('auth.loginSubtitle')}</p>
          </div>

          <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('auth.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@email.com"
                autoComplete="email"
                className={field}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t('auth.password')}</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
            </label>
            <div className="-mt-1 text-right">
              <Link
                to={localize('/forgot-password')}
                className="text-sm font-medium text-brand-deep hover:underline"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-deep py-4 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              {t('auth.login')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-secondary-text">
            {t('auth.noAccount')}{' '}
            <Link to={localize('/signup')} className="font-medium text-brand-deep hover:underline">
              {t('auth.signupLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

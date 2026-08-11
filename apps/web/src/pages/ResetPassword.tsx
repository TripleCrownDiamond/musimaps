import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { PasswordGauge } from '../components/PasswordGauge'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Supabase redirige vers /reset-password#access_token=…&type=recovery.
  // Le client (detectSessionInUrl) émet PASSWORD_RECOVERY quand la session
  // de récupération est détectée : on valide alors le formulaire.
  useEffect(() => {
    const check = async () => {
      const hash = window.location.hash
      if (hash.includes('type=recovery')) {
        setReady('ok')
        return
      }
      const { data } = await supabase?.auth.getSession() ?? { data: { session: null } }
      setReady(data.session ? 'ok' : 'invalid')
    }
    void check()
    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady('ok')
    })
    return () => {
      sub?.data.subscription.unsubscribe()
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return toast.error(t('auth.passwordShort'))
    if (password !== confirm) return toast.error(t('auth.passwordMismatch'))
    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) return toast.error(error.message)
    setDone(true)
  }

  const field =
    'w-full rounded-2xl border border-hairline-strong px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-deep'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-warm-white px-6 pt-44 pb-24">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-hairline bg-surface p-8 shadow-xl">
          {ready === 'checking' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-brand-deep" />
            </div>
          )}

          {ready === 'invalid' && (
            <>
              <div className="mb-5 flex flex-col items-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                  <KeyRound className="h-7 w-7" />
                </span>
                <h1 className="display-font text-center text-3xl font-bold">{t('auth.resetTitle')}</h1>
                <p className="mt-1.5 text-center text-sm text-secondary-text">{t('auth.resetInvalidLink')}</p>
              </div>
              <Link
                to={localize('/forgot-password')}
                className="block w-full rounded-full bg-brand-deep py-4 text-center font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
              >
                {t('auth.forgotTitle')}
              </Link>
            </>
          )}

          {ready === 'ok' && !done && (
            <>
              <div className="mb-5 flex flex-col items-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black">
                  <Lock className="h-7 w-7" />
                </span>
                <h1 className="display-font text-center text-3xl font-bold">{t('auth.resetTitle')}</h1>
                <p className="mt-1.5 text-center text-sm text-secondary-text">{t('auth.resetSubtitle')}</p>
              </div>

              <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
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

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-deep py-4 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
                  {t('auth.resetSubmit')}
                </button>
              </form>
            </>
          )}

          {done && (
            <>
              <div className="mb-5 flex flex-col items-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <h1 className="display-font text-center text-3xl font-bold">{t('auth.resetDone')}</h1>
                <p className="mt-1.5 text-center text-sm text-secondary-text">{t('auth.resetDoneText')}</p>
              </div>
              <Link
                to={localize('/login')}
                className="block w-full rounded-full bg-brand-deep py-4 text-center font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02]"
              >
                {t('auth.resetGoLogin')}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

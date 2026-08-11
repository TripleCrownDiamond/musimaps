import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Loader2, MailCheck, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function ForgotPassword() {
  const { resetPasswordForEmail } = useAuth()
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) return toast.error(t('auth.invalidEmail'))
    setBusy(true)
    const { error } = await resetPasswordForEmail(email)
    setBusy(false)
    if (error) return toast.error(error.message)
    setSent(true)
  }

  const field =
    'w-full rounded-2xl border border-hairline-strong px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-deep'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-warm-white px-6 pt-44 pb-24">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-hairline bg-surface p-8 shadow-xl">
          <div className="mb-5 flex flex-col items-center">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black">
              {sent ? <MailCheck className="h-7 w-7" /> : <KeyRound className="h-7 w-7" />}
            </span>
            <h1 className="display-font text-center text-3xl font-bold">
              {sent ? t('auth.forgotSent') : t('auth.forgotTitle')}
            </h1>
            <p className="mt-1.5 text-center text-sm text-secondary-text">
              {sent ? t('auth.forgotSentText') : t('auth.forgotSubtitle')}
            </p>
          </div>

          {!sent && (
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

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-deep py-4 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                {t('auth.forgotSend')}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-secondary-text">
            <Link to={localize('/login')} className="font-medium text-brand-deep hover:underline">
              {t('auth.forgotBackToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { OAUTH_PROVIDERS, startOAuthSignIn } from '@musimaps/shared'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'

/** Logo Google officiel (multicolore) — la marque impose ses couleurs. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/**
 * « Continuer avec Google » au-dessus du formulaire e-mail — même parcours que
 * `SocialAuthButtons` côté mobile ; logique dans `@musimaps/shared/lib/auth`.
 * Supabase redirige vers `/login`, où la session est lue dans l'URL.
 */
export default function SocialAuthButtons() {
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const [busy, setBusy] = useState(false)

  const signIn = async () => {
    setBusy(true)
    const { error } = await startOAuthSignIn('google', {
      redirectTo: `${window.location.origin}${localize('/login')}`,
    })
    // En cas de succès, la page part chez Google : on ne revient ici qu'en erreur.
    if (error) {
      setBusy(false)
      toast.error(t('auth.oauthError'))
    }
  }

  return (
    <div className="grid gap-4">
      {OAUTH_PROVIDERS.web.map((provider) => (
        <button
          key={provider}
          type="button"
          disabled={busy}
          onClick={() => void signIn()}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-hairline-strong bg-surface py-3.5 font-bold transition-colors hover:bg-secondary-bg disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleLogo />}
          {t('auth.continueGoogle')}
        </button>
      ))}
      <div className="flex items-center gap-3 text-xs text-secondary-text">
        <span className="h-px flex-1 bg-hairline" />
        {t('auth.orEmail')}
        <span className="h-px flex-1 bg-hairline" />
      </div>
    </div>
  )
}

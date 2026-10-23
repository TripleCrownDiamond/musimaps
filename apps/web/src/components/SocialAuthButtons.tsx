import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { OAUTH_PROVIDERS, startOAuthSignIn, type OAuthProvider } from '@musimaps/shared'
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

/** Logo Apple — noir sur fond clair, blanc sur fond sombre (règles d'Apple). */
function AppleLogo() {
  return (
    <svg viewBox="0 0 384 512" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  )
}

const PROVIDER_UI: Record<OAuthProvider, { label: 'auth.continueGoogle' | 'auth.continueApple'; Logo: () => React.JSX.Element }> = {
  google: { label: 'auth.continueGoogle', Logo: GoogleLogo },
  apple: { label: 'auth.continueApple', Logo: AppleLogo },
}

/**
 * « Continuer avec Google / Apple » au-dessus du formulaire e-mail — même parcours que
 * `SocialAuthButtons` côté mobile ; logique dans `@musimaps/shared/lib/auth`.
 * Supabase redirige vers `/login`, où la session est lue dans l'URL.
 */
export default function SocialAuthButtons() {
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const [busy, setBusy] = useState<OAuthProvider | null>(null)

  const signIn = async (provider: OAuthProvider) => {
    setBusy(provider)
    const { error } = await startOAuthSignIn(provider, {
      redirectTo: `${window.location.origin}${localize('/login')}`,
    })
    // En cas de succès, la page part chez Google ou Apple : on ne revient ici qu'en erreur.
    if (error) {
      setBusy(null)
      toast.error(t('auth.oauthError'))
    }
  }

  return (
    <div className="grid gap-4">
      {OAUTH_PROVIDERS.web.map((provider) => {
        const { label, Logo } = PROVIDER_UI[provider]
        return (
          <button
            key={provider}
            type="button"
            disabled={busy !== null}
            onClick={() => void signIn(provider)}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-hairline-strong bg-surface py-3.5 font-bold transition-colors hover:bg-secondary-bg disabled:opacity-60"
          >
            {busy === provider ? <Loader2 className="h-5 w-5 animate-spin" /> : <Logo />}
            {t(label)}
          </button>
        )
      })}
      <div className="flex items-center gap-3 text-xs text-secondary-text">
        <span className="h-px flex-1 bg-hairline" />
        {t('auth.orEmail')}
        <span className="h-px flex-1 bg-hairline" />
      </div>
    </div>
  )
}

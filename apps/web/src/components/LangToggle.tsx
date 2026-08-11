import { useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/LanguageContext'
import type { Lang } from '../i18n/translations'
import { cn } from '../lib/utils'

/** Sélecteur de langue FR/EN affiché dans la navbar. */
export default function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLanguage()
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()

  /** Bascule la locale en conservant le chemin courant (préfixe `/en` en plus ou en moins). */
  const switchLang = (code: Lang) => {
    if (code === lang) return
    setLang(code)
    const stripped = pathname.replace(/^\/(fr|en)(?=\/|$)/, '') || '/'
    const target = code === 'fr' ? stripped : stripped === '/' ? '/en' : `/en${stripped}`
    navigate(target + search + hash)
  }

  return (
    <div
      role="group"
      aria-label="Langue"
      className={cn(
        'flex h-10 items-center rounded-full border border-hairline-strong p-1',
        className,
      )}
    >
      {(['fr', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => switchLang(code)}
          aria-pressed={lang === code}
          title={code === 'fr' ? 'Français' : 'English'}
          className={cn(
            'h-8 min-w-8 rounded-full px-2 text-xs font-bold uppercase transition-colors',
            lang === code
              ? 'bg-brand text-black'
              : 'text-secondary-text hover:text-primary-text',
          )}
        >
          {code}
        </button>
      ))}
    </div>
  )
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { translate } from '@musimaps/shared'
import {
  LANG_PATH_RE,
  localizePath,
  type Lang,
  type MessageKey,
} from './translations'

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Traduit une clé d'interface (params optionnels : {count}, {query}…). */
  t: (key: MessageKey, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'fr',
  setLang: () => {},
  t: (key) => key,
})

/**
 * Langue initiale depuis l'URL uniquement : `/en/...` → anglais, sinon
 * français. La locale par défaut du site est le français (`/`) ; la version
 * anglaise vit sous `/en` pour toutes les routes.
 */
function initialLang(): Lang {
  if (typeof window === 'undefined') return 'fr'
  const fromUrl = window.location.pathname.match(LANG_PATH_RE)
  return fromUrl ? (fromUrl[1] as Lang) : 'fr'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  // La langue est toujours pilotée par l'URL (LangRoute dans App) : aucun
  // choix persistant, aucune détection automatique. `/` = français,
  // `/en/...` = anglais.
  const setLang = useCallback((next: Lang) => {
    setLangState(next)
  }, [])

  // Document lang pour l'accessibilité et le SEO.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) =>
      translate(lang, key, params),
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}

/**
 * Renvoie une fonction qui préfixe un chemin interne par la langue active :
 * `/globe` → `/fr/globe`. Utilisez-la pour tous les liens internes (Link, navigate).
 */
export function useLocalizedPath(): (path: string) => string {
  const { lang } = useLanguage()
  return useCallback((path: string) => localizePath(path, lang), [lang])
}

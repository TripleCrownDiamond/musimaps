import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'musimaps.theme'

export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(KEY)
  return value === 'light' || value === 'dark' ? value : null
}

export function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // stockage indisponible : le theme reste applique pour la session
  }
}

/** Suit en direct le theme applique sur <html> (bascule via le toggle). */
export function useThemeValue(): Theme {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== 'undefined' ? currentTheme() : 'light',
  )
  useEffect(() => {
    const sync = () => setTheme(currentTheme())
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])
  return theme
}

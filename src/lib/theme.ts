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

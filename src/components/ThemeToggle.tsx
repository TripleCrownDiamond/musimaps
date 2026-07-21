import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, currentTheme, type Theme } from '../lib/theme'

interface ThemeToggleProps {
  className?: string
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('light')

  // Synchronise l'etat local avec le theme deja applique au chargement.
  useEffect(() => setTheme(currentTheme()), [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  const label = theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-hairline-strong transition-colors hover:bg-secondary-bg ${className}`}
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}

import { Pause, Play } from 'lucide-react'

interface RotateToggleProps {
  active: boolean
  onToggle: () => void
  /** `dark` pour un bouton pose sur une section noire. */
  theme?: 'light' | 'dark'
  className?: string
}

export default function RotateToggle({
  active,
  onToggle,
  theme = 'light',
  className = '',
}: RotateToggleProps) {
  const base =
    theme === 'dark'
      ? 'bg-white/10 hover:bg-white/20 backdrop-blur-xl'
      : 'bg-white/85 hover:bg-white shadow-lg backdrop-blur-xl'

  const label = active ? 'Mettre la rotation en pause' : 'Relancer la rotation'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${base} ${className}`}
    >
      {active ? (
        <Pause className="h-5 w-5 fill-current text-brand-deep" />
      ) : (
        <Play className="h-5 w-5 fill-current text-brand-deep" />
      )}
    </button>
  )
}

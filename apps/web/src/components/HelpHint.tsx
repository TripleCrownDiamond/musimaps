import { useEffect, useId, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'

interface HelpHintProps {
  /** Texte d'aide affiché. Une à trois phrases : au-delà, c'est de la doc. */
  text: string
  /** Nom accessible du bouton — décrit CE QUE l'aide explique. */
  label: string
}

/**
 * Bulle d'aide contextuelle, ouverte au clic.
 *
 * Volontairement PAS un tooltip au survol : le survol n'existe pas au doigt,
 * et l'essentiel du trafic de Musimaps est mobile. Un tooltip classique serait
 * invisible pour la majorité des utilisateurs — et inatteignable au clavier.
 *
 * Le panneau se ferme à l'Échap et au clic extérieur ; le bouton porte
 * `aria-expanded` et `aria-controls` pour que les lecteurs d'écran annoncent
 * l'état, et le panneau est en `role="note"` pour être lu comme une remarque.
 */
export default function HelpHint({ text, label }: HelpHintProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <span ref={rootRef} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        className="text-secondary-text hover:text-brand-deep focus-visible:ring-brand-deep flex h-6 w-6 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="border-hairline bg-surface absolute top-8 left-0 z-40 w-64 rounded-xl border p-3 text-sm leading-relaxed font-normal shadow-xl sm:w-72"
        >
          {text}
        </span>
      )}
    </span>
  )
}

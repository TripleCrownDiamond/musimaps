import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  /** Délai (ms) avant l'entrée en scène. */
  delay?: number
  /** Direction d'entrée. */
  from?: 'up' | 'left' | 'right' | 'zoom' | 'none'
  className?: string
  /** Ne joue l'animation qu'une fois (défaut true). */
  once?: boolean
  /** Appelé quand l'élément devient visible (utile pour les timelines). */
  onReveal?: () => void
  style?: CSSProperties
}

const TRANSLATES: Record<NonNullable<RevealProps['from']>, string> = {
  up: 'translateY(2.5rem)',
  left: 'translateX(-2.5rem)',
  right: 'translateX(2.5rem)',
  zoom: 'scale(0.9)',
  none: 'none',
}

/**
 * Révèle son contenu au scroll (IntersectionObserver).
 * L'entrée est pilotée par une animation CSS (revealIn) — plus fiable que
 * les transitions — avec l'état inline en secours. Respecte
 * prefers-reduced-motion : tout s'affiche d'un coup.
 */
export default function Reveal({
  children,
  delay = 0,
  from = 'up',
  className,
  once = true,
  onReveal,
  style,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true)
      fired.current = true
      onReveal?.()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true
            setVisible(true)
            onReveal?.()
            if (once) io.disconnect()
          } else if (!entry.isIntersecting && !once) {
            fired.current = false
            setVisible(false)
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -48px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [once])

  return (
    <div
      ref={ref}
      className={className}
      data-revealed={visible ? 'true' : 'false'}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : TRANSLATES[from],
        animation: visible ? `revealIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both` : undefined,
        '--reveal-from': TRANSLATES[from],
        ...style,
      } as CSSProperties}
    >
      {children}
    </div>
  )
}

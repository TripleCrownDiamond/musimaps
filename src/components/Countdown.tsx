import { useEffect, useState } from 'react'
import { getCountdown } from '../lib/launch'

const labels: Array<[keyof ReturnType<typeof getCountdown>, string]> = [
  ['days', 'jours'],
  ['hours', 'heures'],
  ['minutes', 'minutes'],
  ['seconds', 'secondes'],
]

interface CountdownProps {
  /** `dark` pour un compteur pose sur une section noire. */
  theme?: 'light' | 'dark'
}

export default function Countdown({ theme = 'light' }: CountdownProps) {
  const [time, setTime] = useState(() => getCountdown())

  useEffect(() => {
    const id = setInterval(() => setTime(getCountdown()), 1000)
    return () => clearInterval(id)
  }, [])

  const box =
    theme === 'dark'
      ? 'bg-white/5 border-white/10 text-white'
      : 'bg-secondary-bg border-hairline text-primary-text'
  const caption = theme === 'dark' ? 'text-gray-400' : 'text-secondary-text'

  if (time.launched) {
    return (
      <p className={`display-font text-2xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>
        MusiMaps est en ligne.
      </p>
    )
  }

  return (
    <div>
      <p className={`mb-4 text-sm uppercase tracking-widest ${caption}`}>Lancement dans</p>
      <div className="flex justify-center gap-2 sm:gap-3">
        {labels.map(([key, label]) => (
          <div
            key={key}
            className={`min-w-[72px] rounded-2xl border px-3 py-4 sm:min-w-[92px] ${box}`}
          >
            <div className="display-font text-3xl font-extrabold tabular-nums sm:text-5xl">
              {String(time[key]).padStart(2, '0')}
            </div>
            <div className={`mt-1 text-[11px] uppercase tracking-widest ${caption}`}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

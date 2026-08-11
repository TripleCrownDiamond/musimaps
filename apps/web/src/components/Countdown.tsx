import { useEffect, useState } from 'react'
import { getCountdown, LAUNCH_DATE } from '../lib/launch'

const labels: Array<[keyof ReturnType<typeof getCountdown>, string]> = [
  ['days', 'jours'],
  ['hours', 'heures'],
  ['minutes', 'minutes'],
  ['seconds', 'secondes'],
]

interface CountdownProps {
  /** `dark` pour un compteur pose sur une section noire. */
  theme?: 'light' | 'dark'
  /** Date de lancement (ISO) fournie par le CMS. Repli sur VITE_LAUNCH_DATE sinon. */
  launchDate?: string
  /** Libellés configurables depuis le dashboard. */
  label?: string
  onlineLabel?: string
}

function resolveDate(launchDate?: string): Date {
  if (launchDate) {
    const parsed = new Date(launchDate)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return LAUNCH_DATE
}

export default function Countdown({
  theme = 'light',
  launchDate,
  label = 'Lancement dans',
  onlineLabel = 'Musimaps est en ligne.',
}: CountdownProps) {
  const [time, setTime] = useState(() => getCountdown(resolveDate(launchDate)))

  useEffect(() => {
    setTime(getCountdown(resolveDate(launchDate)))
    const id = setInterval(() => setTime(getCountdown(resolveDate(launchDate))), 1000)
    return () => clearInterval(id)
  }, [launchDate])

  const box =
    theme === 'dark'
      ? 'bg-white/5 border-white/10 text-white'
      : 'bg-secondary-bg border-hairline text-primary-text'
  const caption = theme === 'dark' ? 'text-gray-400' : 'text-secondary-text'

  if (time.launched) {
    return (
      <p className={`display-font text-2xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>
        {onlineLabel}
      </p>
    )
  }

  return (
    <div>
      <p className={`mb-4 text-sm uppercase tracking-widest ${caption}`}>{label}</p>
      <div className="flex justify-center gap-2 sm:gap-3">
        {labels.map(([key, unitLabel]) => (
          <div
            key={key}
            className={`min-w-[72px] rounded-2xl border px-3 py-4 sm:min-w-[92px] ${box}`}
          >
            <div className="display-font text-3xl font-extrabold tabular-nums sm:text-5xl">
              {String(time[key]).padStart(2, '0')}
            </div>
            <div className={`mt-1 text-[11px] uppercase tracking-widest ${caption}`}>{unitLabel}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

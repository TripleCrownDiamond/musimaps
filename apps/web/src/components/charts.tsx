import { useId, type ReactNode } from 'react'
import { compactNumber } from '@/lib/utils'

/**
 * Kit de graphiques minimal — pur SVG, aucune dépendance.
 * Couleurs issues des variables du design system (--color-brand / --color-brand-deep)
 * pour rester cohérent en thème clair comme sombre.
 */

export interface ChartDatum {
  label: string
  value: number
  /** Sous-texte optionnel (ex. nombre d'auditeurs uniques). */
  sub?: string
}

/** -------------------------------------------------------------
 * BarChart — histogramme vertical (ex. vues des 14 derniers jours).
 * ------------------------------------------------------------- */
export function BarChart({
  data,
  height = 180,
  color = 'var(--color-brand-deep)',
  highlight = 'var(--color-brand)',
}: {
  data: ChartDatum[]
  height?: number
  color?: string
  highlight?: string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const barW = 100 / data.length
  const pad = Math.min(14, barW * 0.3)

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        role="img"
        aria-label="Histogramme"
      >
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 3 : 1.2, (d.value / max) * height)
          const x = i * barW + pad / 2
          const y = height - h
          const isMax = d.value === max && max > 1
          return (
            <g key={`${d.label}-${i}`}>
              <title>{`${d.label} : ${d.value}`}</title>
              <rect
                x={x}
                y={y}
                width={barW - pad}
                height={h}
                rx={Math.min(3, (barW - pad) / 2)}
                fill={isMax ? highlight : color}
                opacity={isMax ? 1 : 0.75}
              />
            </g>
          )
        })}
      </svg>
      {/* Libellés en HTML (hors SVG) : non déformés par preserveAspectRatio="none". */}
      <div className="mt-1.5 flex gap-0">
        {data.map((d, i) => (
          <span
            key={`${d.label}-${i}`}
            className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** -------------------------------------------------------------
 * HBarList — barres horizontales (ex. top pays, top artistes).
 * ------------------------------------------------------------- */
export function HBarList({
  data,
  max,
  format = compactNumber,
  showSub,
}: {
  data: ChartDatum[]
  max?: number
  format?: (v: number) => string
  showSub?: boolean
}) {
  const peak = max ?? Math.max(...data.map((d) => d.value), 1)
  return (
    <ul className="grid gap-3">
      {data.map((d, i) => {
        const isMax = d.value === peak && peak > 1
        const width = Math.max(1, Math.round((d.value / peak) * 100))
        return (
          <li key={`${d.label}-${i}`} className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{d.label}</span>
              <span className="shrink-0 text-secondary-text tabular-nums">
                {format(d.value)}
                {showSub && d.sub ? <span className="ml-1 text-xs">· {d.sub}</span> : null}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-secondary-bg">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isMax ? 'bg-brand' : 'bg-brand-deep'
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** -------------------------------------------------------------
 * Donut — répartition en anneau (ex. profil vs pin, types de comptes).
 * ------------------------------------------------------------- */
export function Donut({
  segments,
  size = 168,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string | number
}) {
  const total = Math.max(segments.reduce((sum, s) => sum + s.value, 0), 1)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label="Répartition">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-secondary-bg)"
          strokeWidth={thickness}
        />
        {segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const len = (s.value / total) * circumference
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              >
                <title>{`${s.label} : ${s.value}`}</title>
              </circle>
            )
            offset += len
            return el
          })}
        {centerValue !== undefined && (
          <text
            x="50%"
            y="47%"
            textAnchor="middle"
            fill="currentColor"
            fontSize={size * 0.16}
            fontWeight="800"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x="50%"
            y="58%"
            textAnchor="middle"
            fontSize={size * 0.07}
            fill="var(--muted-foreground)"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="shrink-0 font-bold tabular-nums">{compactNumber(s.value)}</span>
            </li>
          ))}
        {segments.every((s) => s.value <= 0) && (
          <li className="text-sm text-muted-foreground">Aucune donnée</li>
        )}
      </ul>
    </div>
  )
}

/** -------------------------------------------------------------
 * TrendArea — courbe avec remplissage en dégradé (ex. évolution 14 j).
 * ------------------------------------------------------------- */
export function TrendArea({
  data,
  height = 160,
  color = 'var(--color-brand-deep)',
  fillColor = 'var(--color-brand-deep)',
}: {
  data: number[]
  height?: number
  color?: string
  fillColor?: string
}) {
  const gradientId = useId()
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = Math.max(max - min, 1)
  const step = data.length > 1 ? 100 / (data.length - 1) : 0
  const padY = 10
  const plotH = height - padY * 2

  const points = data.map((v, i) => {
    const x = data.length > 1 ? i * step : 50
    const y = padY + plotH - ((v - min) / range) * plotH
    return [x, y] as const
  })
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L100,${height} L0,${height} Z`
  const last = points[points.length - 1]
  const lastX = last ? last[0] : 0
  const lastY = last ? last[1] : 0

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="block w-full" role="img" aria-label="Courbe d'évolution">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.22" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {data.length > 1 && <path d={area} fill={`url(#${gradientId})`} />}
      {data.length > 1 && (
        <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {last && <circle cx={lastX} cy={lastY} r="2.6" fill={color} />}
    </svg>
  )
}

/** -------------------------------------------------------------
 * ChartCard — carte conteneur cohérente pour chaque graphique.
 * ------------------------------------------------------------- */
export function ChartCard({
  title,
  subtitle,
  children,
  right,
  className,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-3xl border border-hairline bg-surface p-5 ${className ?? ''}`.trim()}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-secondary-text">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

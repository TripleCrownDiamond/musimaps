interface PulseDotsProps {
  positions: Array<{ top: string; left: string; user?: boolean }>
}

export default function PulseDots({ positions }: PulseDotsProps) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {positions.map((pos, i) => (
        <div
          key={i}
          className={`pulse-dot ${pos.user ? 'pulse-user' : ''}`}
          style={{ top: pos.top, left: pos.left }}
        />
      ))}
    </div>
  )
}

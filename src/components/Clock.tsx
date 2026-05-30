interface ClockProps {
  ms: number
  active: boolean
  label: string
}

function format(ms: number): string {
  const total = Math.max(0, ms)
  const mins = Math.floor(total / 60000)
  const secs = Math.floor((total % 60000) / 1000)
  if (total < 20000) {
    // Show tenths in the last 20 seconds.
    const tenths = Math.floor((total % 1000) / 100)
    return `${secs}.${tenths}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function Clock({ ms, active, label }: ClockProps) {
  const low = ms <= 10000
  const cls = ['clock', active ? 'active' : '', low ? 'low' : ''].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      <span className="clock-label">{label}</span>
      <span className="clock-time">{format(ms)}</span>
    </div>
  )
}

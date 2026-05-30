import type { EndgameTheme } from '../chess/types'

interface ControlsProps {
  themes: EndgameTheme[]
  themeId: string
  theme: EndgameTheme
  onThemeChange: (id: string) => void
  handicap: number
  onHandicapChange: (h: number) => void
  rating: number
  onRatingChange: (r: number) => void
  moveTimeSec: number
  onMoveTimeChange: (s: number) => void
  onRandomize: () => void
  onFlip: () => void
  disabled: boolean
}

function ratingLabel(r: number): string {
  if (r < 1000) return 'Beginner'
  if (r < 1300) return 'Casual'
  if (r < 1600) return 'Club'
  if (r < 1900) return 'Strong'
  return 'Expert'
}

export default function Controls(p: ControlsProps) {
  const usesSlider = p.theme.materialBalance === null

  return (
    <aside className="controls">
      <button className="btn btn-primary big" onClick={p.onRandomize} disabled={p.disabled}>
        🎲 Randomize again
      </button>

      <section className="ctrl-section">
        <label className="ctrl-label">Endgame type</label>
        <select value={p.themeId} onChange={(e) => p.onThemeChange(e.target.value)} disabled={p.disabled}>
          {p.themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.materialBalance !== null
                ? `  (${t.materialBalance >= 0 ? '+' : ''}${t.materialBalance})`
                : ''}
            </option>
          ))}
        </select>
        <p className="ctrl-desc">{p.theme.description}</p>
      </section>

      <section className="ctrl-section">
        <label className="ctrl-label">
          Opponent strength: <strong>{p.rating}</strong> <span className="pill">{ratingLabel(p.rating)}</span>
        </label>
        <input
          type="range"
          min={800}
          max={2000}
          step={50}
          value={p.rating}
          onChange={(e) => p.onRatingChange(Number(e.target.value))}
        />
        <div className="range-ends"><span>800</span><span>2000</span></div>
        <p className="ctrl-hint">Adjustable any time — even mid-game.</p>
      </section>

      <section className="ctrl-section">
        <label className="ctrl-label">
          Material handicap: <strong>{p.handicap >= 0 ? `+${p.handicap}` : p.handicap}</strong>
        </label>
        <input
          type="range"
          min={-2}
          max={5}
          step={1}
          value={p.handicap}
          onChange={(e) => p.onHandicapChange(Number(e.target.value))}
          disabled={!usesSlider}
        />
        <div className="range-ends"><span>-2</span><span>+5</span></div>
        <p className="ctrl-hint">
          {usesSlider
            ? 'Points of material you start ahead (+) or behind (−).'
            : 'This endgame has a fixed balance. Pick “🎲 Random (by material)” to use this slider.'}
        </p>
      </section>

      <section className="ctrl-section">
        <label className="ctrl-label">
          Engine thinking time: <strong>{p.moveTimeSec}s</strong> / move
        </label>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={p.moveTimeSec}
          onChange={(e) => p.onMoveTimeChange(Number(e.target.value))}
        />
        <div className="range-ends"><span>1s</span><span>5s</span></div>
      </section>

      <section className="ctrl-section row">
        <button className="btn" onClick={p.onFlip} disabled={p.disabled}>⟲ Flip board</button>
      </section>
    </aside>
  )
}

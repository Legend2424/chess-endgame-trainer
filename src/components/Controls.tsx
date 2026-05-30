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
  defendMode: boolean
  onDefendChange: (d: boolean) => void
  baseMin: number
  onBaseMinChange: (m: number) => void
  incSec: number
  onIncSecChange: (s: number) => void
  onRandomize: () => void
  onUndo: () => void
  canUndo: boolean
  onFlip: () => void
  onSetupBoard: () => void
  editorActive: boolean
  disabled: boolean
}

function ratingLabel(r: number): string {
  if (r < 1000) return 'Beginner'
  if (r < 1300) return 'Casual'
  if (r < 1600) return 'Club'
  if (r < 1900) return 'Strong'
  return 'Expert'
}

const BASE_OPTIONS = [
  { v: 0, label: 'Off' },
  { v: 1, label: '1 min' },
  { v: 3, label: '3 min' },
  { v: 5, label: '5 min' },
  { v: 10, label: '10 min' },
  { v: 15, label: '15 min' },
  { v: 30, label: '30 min' },
]
const INC_OPTIONS = [0, 2, 3, 5, 10]

export default function Controls(p: ControlsProps) {
  const usesSlider = p.theme.materialBalance === null

  return (
    <aside className="controls">
      <div className="row gap">
        <button className="btn btn-primary big grow" onClick={p.onRandomize} disabled={p.disabled}>
          🎲 Randomize again
        </button>
      </div>
      <div className="row gap">
        <button className="btn grow" onClick={p.onUndo} disabled={!p.canUndo}>↶ Take back</button>
        <button className="btn grow" onClick={p.onFlip} disabled={p.disabled || p.editorActive}>⟲ Flip</button>
      </div>
      <div className="row gap">
        <button
          className={'btn grow' + (p.editorActive ? ' btn-primary' : '')}
          onClick={p.onSetupBoard}
          disabled={p.disabled || p.editorActive}
        >
          ✏ Set up board
        </button>
      </div>

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
        <label className="ctrl-label">Clock</label>
        <div className="row gap">
          <select
            className="grow"
            value={p.baseMin}
            onChange={(e) => p.onBaseMinChange(Number(e.target.value))}
            disabled={p.disabled}
          >
            {BASE_OPTIONS.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
          <select
            className="grow"
            value={p.incSec}
            onChange={(e) => p.onIncSecChange(Number(e.target.value))}
            disabled={p.disabled || p.baseMin === 0}
          >
            {INC_OPTIONS.map((s) => (
              <option key={s} value={s}>+{s}s / move</option>
            ))}
          </select>
        </div>
        <p className="ctrl-hint">
          {p.baseMin === 0
            ? 'No clock — play untimed.'
            : `${p.baseMin} min + ${p.incSec}s increment. Changing this restarts the position.`}
        </p>
      </section>

      <section className="ctrl-section">
        <label className="toggle">
          <input
            type="checkbox"
            checked={p.defendMode}
            onChange={(e) => p.onDefendChange(e.target.checked)}
            disabled={p.disabled}
          />
          <span>Defend the worse side <span className="pill alt">draw = win</span></span>
        </label>
        <p className="ctrl-hint">
          {p.defendMode
            ? 'You play the harder side — try to hold a draw or survive.'
            : 'You play the stronger side and try to convert the win.'}
        </p>
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
    </aside>
  )
}

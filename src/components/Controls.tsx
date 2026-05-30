import type { PuzzleCategory, Difficulty } from '../chess/puzzleDb'

interface ControlsProps {
  categories: PuzzleCategory[]
  categoryBit: number
  onCategoryChange: (bit: number) => void
  difficulties: Difficulty[]
  difficultyId: string
  onDifficultyChange: (id: string) => void
  rating: number
  onRatingChange: (r: number) => void
  moveTimeSec: number
  onMoveTimeChange: (s: number) => void
  defendMode: boolean
  onDefendChange: (d: boolean) => void
  evalOn: boolean
  onEvalChange: (v: boolean) => void
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

function fmtCount(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
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
        <label className="ctrl-label">Endgame category (from real games)</label>
        <select
          value={p.categoryBit}
          onChange={(e) => p.onCategoryChange(Number(e.target.value))}
          disabled={p.disabled || p.categories.length === 0}
        >
          {p.categories.map((c) => (
            <option key={c.bit} value={c.bit}>
              {c.name} ({fmtCount(c.count)})
            </option>
          ))}
        </select>
        <p className="ctrl-hint">Positions taken from real Lichess games (CC0 puzzle database).</p>
      </section>

      <section className="ctrl-section">
        <label className="ctrl-label">Difficulty</label>
        <select
          value={p.difficultyId}
          onChange={(e) => p.onDifficultyChange(e.target.value)}
          disabled={p.disabled}
        >
          {p.difficulties.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <p className="ctrl-hint">Filters puzzles by their Lichess difficulty rating.</p>
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
            : 'You play the side with the advantage and try to convert.'}
        </p>
      </section>

      <section className="ctrl-section">
        <label className="toggle">
          <input
            type="checkbox"
            checked={p.evalOn}
            onChange={(e) => p.onEvalChange(e.target.checked)}
            disabled={p.disabled}
          />
          <span>Show evaluation bar</span>
        </label>
        <p className="ctrl-hint">A bar beside the board showing if the position is winning, drawn, or losing.</p>
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
          {p.baseMin === 0 ? 'No clock — play untimed.' : `${p.baseMin} min + ${p.incSec}s. Changing this loads a fresh puzzle.`}
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

import type { Score } from '../engine/stockfish'

interface EvalBarProps {
  /** Evaluation from White's perspective (null = not yet computed). */
  score: Score | null
  /** The side the human is playing, for the friendly label. */
  playerColor: 'w' | 'b'
}

// Lichess-style win% from centipawns -> fraction of the bar that is White (0..1).
function whiteFraction(score: Score | null): number {
  if (!score) return 0.5
  if (score.mate !== undefined) return score.mate > 0 ? 1 : 0
  const cp = score.cp ?? 0
  const winning = 2 / (1 + Math.exp(-0.004 * cp)) - 1 // -1..1
  return 0.5 + 0.5 * winning
}

// A short, kid-friendly verdict from the *player's* perspective.
function verdict(score: Score | null, playerColor: 'w' | 'b'): string {
  if (!score) return '…'
  const sign = playerColor === 'w' ? 1 : -1
  if (score.mate !== undefined) {
    const m = score.mate * sign
    if (m > 0) return `Mate in ${Math.abs(score.mate)} — you win`
    if (m < 0) return `Mate in ${Math.abs(score.mate)} — you lose`
    return 'Checkmate'
  }
  const cp = (score.cp ?? 0) * sign
  const pawns = (cp / 100).toFixed(1)
  const num = cp > 0 ? `+${pawns}` : pawns
  let word: string
  if (cp >= 500) word = 'Winning'
  else if (cp >= 150) word = 'You’re better'
  else if (cp > -150) word = 'About equal'
  else if (cp > -500) word = 'You’re worse'
  else word = 'Losing'
  return `${word} (${num})`
}

export default function EvalBar({ score, playerColor }: EvalBarProps) {
  const whitePct = Math.round(whiteFraction(score) * 100)
  const label = verdict(score, playerColor)
  return (
    <div className="evalbar-wrap" title={label}>
      <div className="evalbar">
        {/* White fills from the bottom (universal convention). */}
        <div className="evalbar-white" style={{ height: `${whitePct}%` }} />
      </div>
      <div className="evalbar-verdict">{label}</div>
    </div>
  )
}

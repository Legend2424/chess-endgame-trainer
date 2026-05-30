// Procedural + curated generation of legal, realistic endgame positions.
import { Chess } from 'chess.js'
import type { Color } from './types'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

export type PieceChar =
  | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'
  | 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

type Board = Map<string, PieceChar>

export function sq(file: number, rank: number): string {
  return FILES[file] + String(rank)
}
function fileOf(square: string): number {
  return FILES.indexOf(square[0])
}
function rankOf(square: string): number {
  return Number(square[1])
}
/** Light = true, dark = false. */
export function isLightSquare(square: string): boolean {
  return (fileOf(square) + rankOf(square)) % 2 === 1
}
function kingsAdjacent(a: string, b: string): boolean {
  return Math.abs(fileOf(a) - fileOf(b)) <= 1 && Math.abs(rankOf(a) - rankOf(b)) <= 1
}

function randInt(n: number): number {
  return Math.floor(Math.random() * n)
}
export function pick<T>(arr: T[]): T {
  return arr[randInt(arr.length)]
}

/** Build a FEN from a piece map. */
function toFen(board: Board, sideToMove: Color): string {
  let fen = ''
  for (let rank = 8; rank >= 1; rank--) {
    let empty = 0
    for (let file = 0; file < 8; file++) {
      const p = board.get(sq(file, rank))
      if (p) {
        if (empty) {
          fen += empty
          empty = 0
        }
        fen += p
      } else empty++
    }
    if (empty) fen += empty
    if (rank > 1) fen += '/'
  }
  return `${fen} ${sideToMove} - - 0 1`
}

/** Legal, not already finished, kings not touching, side-not-to-move not in check. */
export function isPlayablePosition(fen: string): boolean {
  // chess.js throws on structurally invalid FENs.
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return false
  }
  if (chess.isGameOver()) return false
  // The side to move must have moves and the position must be sane.
  if (chess.moves().length === 0) return false
  // Kings must not be adjacent.
  const board = chess.board()
  let wk = '', bk = ''
  for (const row of board) {
    for (const cell of row) {
      if (cell?.type === 'k') {
        if (cell.color === 'w') wk = cell.square
        else bk = cell.square
      }
    }
  }
  if (!wk || !bk || kingsAdjacent(wk, bk)) return false
  return true
}

// --- Spec-driven random placement -------------------------------------------

interface PieceSpec {
  char: PieceChar
  /** Allowed rank range [min,max] (1-8). Defaults to 1-8 for pieces, 2-7 pawns. */
  ranks?: [number, number]
  /** Force a square color for bishops: 'light' | 'dark'. */
  squareColor?: 'light' | 'dark'
}

export interface PlacementSpec {
  white: PieceSpec[]
  black: PieceSpec[]
  sideToMove: Color
  playerColor: Color
  goal: string
}

function rankRangeFor(spec: PieceSpec): [number, number] {
  if (spec.ranks) return spec.ranks
  if (spec.char === 'P' || spec.char === 'p') return [2, 7]
  return [1, 8]
}

/** Try to build one legal position from a spec; null if it couldn't within tries. */
export function placeFromSpec(spec: PlacementSpec): string | null {
  for (let attempt = 0; attempt < 400; attempt++) {
    const board: Board = new Map()
    const used = new Set<string>()
    let ok = true

    const place = (ps: PieceSpec) => {
      const [minR, maxR] = rankRangeFor(ps)
      for (let t = 0; t < 60; t++) {
        const file = randInt(8)
        const rank = minR + randInt(maxR - minR + 1)
        const square = sq(file, rank)
        if (used.has(square)) continue
        if (ps.squareColor) {
          const light = isLightSquare(square)
          if (ps.squareColor === 'light' && !light) continue
          if (ps.squareColor === 'dark' && light) continue
        }
        used.add(square)
        board.set(square, ps.char)
        return true
      }
      return false
    }

    for (const ps of [...spec.white, ...spec.black]) {
      if (!place(ps)) {
        ok = false
        break
      }
    }
    if (!ok) continue

    const fen = toFen(board, spec.sideToMove)
    if (isPlayablePosition(fen)) return fen
  }
  return null
}

// --- Curated FEN transforms (multiply variety of theory positions) ----------

/** Mirror a placement left<->right (a-file <-> h-file). Keeps it legal. */
function mirrorFile(fen: string): string {
  const [placement, ...rest] = fen.split(' ')
  const rows = placement.split('/').map((row) => {
    // expand
    let expanded = ''
    for (const ch of row) {
      if (/\d/.test(ch)) expanded += ' '.repeat(Number(ch))
      else expanded += ch
    }
    expanded = expanded.split('').reverse().join('')
    // collapse
    let out = '', empty = 0
    for (const ch of expanded) {
      if (ch === ' ') empty++
      else {
        if (empty) {
          out += empty
          empty = 0
        }
        out += ch
      }
    }
    if (empty) out += empty
    return out
  })
  return [rows.join('/'), ...rest].join(' ')
}

/** Pick a curated FEN and optionally mirror it for variety. */
export function fromBank(fens: string[]): string {
  let fen = pick(fens)
  if (Math.random() < 0.5) fen = mirrorFile(fen)
  return fen
}

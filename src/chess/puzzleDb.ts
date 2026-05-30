// Loader for the bundled Lichess endgame database (public/puzzles/endgames.json).
// Produced by scripts/process-puzzles.mjs from the CC0 Lichess puzzle DB.
//
// Each puzzle is [fen, firstMove, rating, categoryMask]. The FEN is the position
// before the opponent's setup move; we apply that move here so the playable FEN
// has the HUMAN to move with a concrete win/hold task ahead (the puzzle theme).

import { Chess } from 'chess.js'

export interface PuzzleCategory {
  id: string
  name: string
  bit: number
  count: number
}

type RawPuzzle = [string, string, number, number] // fen, firstMove, rating, mask

interface RawDb {
  version: number
  categories: PuzzleCategory[]
  puzzles: RawPuzzle[]
}

export interface Puzzle {
  /** Playable FEN with the human to move (setup move already applied). */
  fen: string
  rating: number
  /** Side to move in the playable FEN — the side the human plays. */
  sideToMove: 'w' | 'b'
}

let db: RawDb | null = null
const byCategory = new Map<number, number[]>()

const DB_URL = `${import.meta.env.BASE_URL}puzzles/endgames.json`

/** Fetch and cache the database. Safe to call repeatedly. */
export async function loadPuzzleDb(): Promise<PuzzleCategory[]> {
  if (db) return db.categories
  const res = await fetch(DB_URL)
  if (!res.ok) throw new Error(`Failed to load puzzle DB (${res.status})`)
  db = (await res.json()) as RawDb
  return db.categories
}

export function getCategories(): PuzzleCategory[] {
  return db?.categories ?? []
}

function indicesFor(bit: number): number[] {
  if (!db) return []
  let list = byCategory.get(bit)
  if (!list) {
    const m = 1 << bit
    list = []
    const puzzles = db.puzzles
    for (let i = 0; i < puzzles.length; i++) {
      if (puzzles[i][3] & m) list.push(i)
    }
    byCategory.set(bit, list)
  }
  return list
}

/** Apply the stored setup move to get the playable position. */
function toPlayable(raw: RawPuzzle): Puzzle | null {
  const [fen, move] = raw
  try {
    const chess = new Chess(fen)
    chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })
    return { fen: chess.fen(), rating: raw[2], sideToMove: chess.turn() }
  } catch {
    return null
  }
}

/**
 * Pick a random playable puzzle from a category. If `ratingBand` is given,
 * prefer puzzles whose Lichess rating falls in that band (falls back to the
 * whole category if too few match). Retries a few times if a move fails to apply.
 */
export function randomPuzzle(categoryBit: number, ratingBand?: [number, number]): Puzzle | null {
  if (!db) return null
  const idxs = indicesFor(categoryBit)
  if (idxs.length === 0) return null

  let pool = idxs
  if (ratingBand) {
    const [lo, hi] = ratingBand
    const filtered = idxs.filter((i) => {
      const r = db!.puzzles[i][2]
      return r >= lo && r <= hi
    })
    if (filtered.length >= 20) pool = filtered
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const raw = db.puzzles[pool[Math.floor(Math.random() * pool.length)]]
    const p = toPlayable(raw)
    if (p) return p
  }
  return null
}

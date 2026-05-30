// Build a compact, bundled endgame database from the Lichess puzzle DB (CC0).
//
// Input:  C:\Claude\_work\puzzles.csv.zst  (lichess_db_puzzle.csv.zst)
// Output: public/puzzles/endgames.json     (categories + packed puzzles)
//
// Lichess CSV columns:
//   PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
//
// A Lichess puzzle FEN is the position BEFORE the setup move; the first move in
// `Moves` is the opponent's move that creates the puzzle. We store the FEN and
// that first move as strings; the browser applies the move when the puzzle is
// chosen (one move per puzzle PLAYED, not millions at build time). This keeps
// this script pure string work, so it runs in well under a minute.
//
// Run: node --max-old-space-size=4096 scripts/process-puzzles.mjs

import fs from 'node:fs'
import zlib from 'node:zlib'
import readline from 'node:readline'

const SRC = 'C:\\Claude\\_work\\puzzles.csv.zst'
const OUT_DIR = 'public/puzzles'
const OUT = `${OUT_DIR}/endgames.json`

// How many puzzles to keep in the shipped bundle. Sampled evenly across the
// full endgame set to preserve theme + rating diversity.
const TARGET = 220_000

// Curated category themes; a bitmask is built per puzzle over these (order =
// bit index). Only themes that actually occur are shown as categories.
const CATEGORY_THEMES = [
  ['endgame', 'All endgames'],
  ['pawnEndgame', 'Pawn endgame'],
  ['rookEndgame', 'Rook endgame'],
  ['knightEndgame', 'Knight endgame'],
  ['bishopEndgame', 'Bishop endgame'],
  ['queenEndgame', 'Queen endgame'],
  ['queenRookEndgame', 'Queen & rook endgame'],
  ['zugzwang', 'Zugzwang'],
  ['advancedPawn', 'Advanced pawn'],
  ['promotion', 'Promotion'],
  ['defensiveMove', 'Defensive move'],
  ['quietMove', 'Quiet move'],
  ['fork', 'Fork'],
  ['pin', 'Pin'],
  ['skewer', 'Skewer'],
  ['mateIn1', 'Mate in 1'],
  ['mateIn2', 'Mate in 2'],
  ['mateIn3', 'Mate in 3'],
  ['mate', 'Checkmate'],
]
const themeIndex = new Map(CATEGORY_THEMES.map(([id], i) => [id, i]))

let totalRows = 0
const kept = [] // [fen, firstMove, rating, mask]

const input = fs.createReadStream(SRC).pipe(zlib.createZstdDecompress())
const rl = readline.createInterface({ input, crlfDelay: Infinity })

let isHeader = true
for await (const line of rl) {
  if (isHeader) { isHeader = false; continue }
  if (!line) continue
  totalRows++
  // Safe to split on comma: FEN/Themes/OpeningTags contain spaces, not commas.
  const cols = line.split(',')
  if (cols.length < 8) continue
  const themes = cols[7]
  if (!themes || !themes.includes('endgame')) continue

  let mask = 0
  for (const t of themes.split(' ')) {
    const idx = themeIndex.get(t)
    if (idx !== undefined) mask |= 1 << idx
  }
  const fen = cols[1]
  const firstMove = cols[2].split(' ')[0]
  if (!fen || !firstMove) continue
  kept.push([fen, firstMove, parseInt(cols[3], 10) || 1500, mask])
}

// Sample down to TARGET, evenly across the collection (preserves distribution).
let sampled = kept
if (kept.length > TARGET) {
  const stride = kept.length / TARGET
  sampled = []
  for (let i = 0; i < TARGET; i++) sampled.push(kept[Math.floor(i * stride)])
}

// Count per category over the SHIPPED sample so displayed numbers are honest.
const counts = new Array(CATEGORY_THEMES.length).fill(0)
for (const p of sampled) {
  const mask = p[3]
  for (let i = 0; i < CATEGORY_THEMES.length; i++) {
    if (mask & (1 << i)) counts[i]++
  }
}
const categories = CATEGORY_THEMES
  .map(([id, name], i) => ({ id, name, bit: i, count: counts[i] }))
  .filter((c) => c.count > 0)

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ version: 2, categories, puzzles: sampled }))

const sizeMB = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1)
console.log(JSON.stringify({
  totalRows,
  endgameKept: kept.length,
  shipped: sampled.length,
  outMB: Number(sizeMB),
  categories: categories.map((c) => `${c.id}:${c.count}`),
}, null, 2))

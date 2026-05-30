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
// chosen, so the human is to move with a concrete win/hold task ahead.
//
// Decompression: Node 24's built-in createZstdDecompress chokes on this file
// ("Unknown frame descriptor"), so we use the pure-JS `fzstd` streaming decoder,
// which handles it fine. (npm i fzstd — installed with --no-save.)
//
// Run: node --max-old-space-size=4096 scripts/process-puzzles.mjs

import fs from 'node:fs'
import * as fzstd from 'fzstd'

const SRC = 'C:\\Claude\\_work\\puzzles.csv.zst'
const OUT_DIR = 'public/puzzles'
const OUT = `${OUT_DIR}/endgames.json`

const TARGET = 220_000

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

const decoder = new TextDecoder()
let carry = '' // partial line spanning chunk boundaries
let isHeader = true

function handleLine(line) {
  if (isHeader) { isHeader = false; return }
  if (!line) return
  totalRows++
  const cols = line.split(',')
  if (cols.length < 8) return
  const themes = cols[7]
  if (!themes || !themes.includes('endgame')) return
  let mask = 0
  for (const t of themes.split(' ')) {
    const idx = themeIndex.get(t)
    if (idx !== undefined) mask |= 1 << idx
  }
  const fen = cols[1]
  const firstMove = cols[2].split(' ')[0]
  if (!fen || !firstMove) return
  kept.push([fen, firstMove, parseInt(cols[3], 10) || 1500, mask])
}

// fzstd streaming: feed compressed chunks, get decompressed Uint8Array chunks.
const stream = new fzstd.Decompress((chunk) => {
  carry += decoder.decode(chunk, { stream: true })
  let nl
  while ((nl = carry.indexOf('\n')) !== -1) {
    let line = carry.slice(0, nl)
    if (line.endsWith('\r')) line = line.slice(0, -1)
    handleLine(line)
    carry = carry.slice(nl + 1)
  }
})

await new Promise((resolve, reject) => {
  const rs = fs.createReadStream(SRC)
  rs.on('data', (buf) => {
    try { stream.push(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)) }
    catch (e) { reject(e) }
  })
  rs.on('end', () => {
    try {
      // Flush the final (possibly empty) frame and any trailing line.
      stream.push(new Uint8Array(0), true)
      if (carry) handleLine(carry)
      resolve()
    } catch (e) { reject(e) }
  })
  rs.on('error', reject)
})

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

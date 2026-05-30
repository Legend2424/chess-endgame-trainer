import type { EndgameTheme, EndgamePosition, GenerateOptions } from './types'
import { placeFromSpec, type PlacementSpec, type PieceChar } from './generator'

// A spec that always white-to-move, human plays White (stronger/active side).
function build(spec: Omit<PlacementSpec, 'sideToMove' | 'playerColor'>): EndgamePosition {
  const full: PlacementSpec = { ...spec, sideToMove: 'w', playerColor: 'w' }
  let fen = placeFromSpec(full)
  // Extremely defensive fallback: a trivially legal KvK+Q if generation fails.
  if (!fen) fen = '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1'
  return { fen, playerColor: 'w', goal: spec.goal }
}

/** Express a material value as a small, endgame-like bundle of pieces. */
function materialToPieces(value: number): PieceChar[] {
  const out: PieceChar[] = []
  let v = value
  // Optionally lead with one bigger piece.
  if (v >= 9 && Math.random() < 0.6) { out.push('Q'); v -= 9 }
  else if (v >= 5 && Math.random() < 0.6) { out.push('R'); v -= 5 }
  else if (v >= 3 && Math.random() < 0.6) { out.push(Math.random() < 0.5 ? 'N' : 'B'); v -= 3 }
  // Fill remainder with pawns (capped to keep it an endgame).
  while (v >= 1 && out.length < 5) { out.push('P'); v -= 1 }
  return out
}

export const THEMES: EndgameTheme[] = [
  {
    id: 'kp_vs_k',
    name: 'King + Pawn vs King',
    description: 'Promote your pawn. The key ideas are the opposition and key squares.',
    difficulty: 'beginner',
    materialBalance: 1,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'P', ranks: [2, 6] }],
        black: [{ char: 'k' }],
        goal: 'Win — escort your pawn to promotion.',
      }),
  },
  {
    id: 'k2p_vs_k',
    name: 'King + 2 Pawns vs King',
    description: 'Two pawns should win. Watch for stalemate tricks near promotion.',
    difficulty: 'beginner',
    materialBalance: 2,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'P', ranks: [2, 6] }, { char: 'P', ranks: [2, 6] }],
        black: [{ char: 'k' }],
        goal: 'Win — promote one of your pawns.',
      }),
  },
  {
    id: 'kr_vs_k',
    name: 'Rook Checkmate',
    description: 'Drive the lone king to the edge and deliver mate with king + rook.',
    difficulty: 'beginner',
    materialBalance: 5,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'R' }],
        black: [{ char: 'k' }],
        goal: 'Checkmate the lone king.',
      }),
  },
  {
    id: 'kq_vs_k',
    name: 'Queen Checkmate',
    description: 'Box the king in with the queen — but avoid stalemate!',
    difficulty: 'beginner',
    materialBalance: 9,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'Q' }],
        black: [{ char: 'k' }],
        goal: 'Checkmate the lone king (avoid stalemate).',
      }),
  },
  {
    id: 'kbb_vs_k',
    name: 'Two Bishops Checkmate',
    description: 'Two bishops mate by herding the king into a corner.',
    difficulty: 'intermediate',
    materialBalance: 6,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'B', squareColor: 'light' }, { char: 'B', squareColor: 'dark' }],
        black: [{ char: 'k' }],
        goal: 'Checkmate using both bishops.',
      }),
  },
  {
    id: 'kbn_vs_k',
    name: 'Bishop + Knight Mate',
    description: 'The famous hard one: mate only happens in the corner the bishop controls.',
    difficulty: 'advanced',
    materialBalance: 6,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'B' }, { char: 'N' }],
        black: [{ char: 'k' }],
        goal: 'Checkmate with bishop + knight (drive king to the right corner).',
      }),
  },
  {
    id: 'kp_vs_kp',
    name: 'Pawn vs Pawn',
    description: 'Equal material — use your king and the opposition to break through.',
    difficulty: 'intermediate',
    materialBalance: 0,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'P', ranks: [2, 5] }],
        black: [{ char: 'k' }, { char: 'p', ranks: [4, 7] }],
        goal: 'Outplay your opponent — promote first or win their pawn.',
      }),
  },
  {
    id: 'kr_vs_kpp',
    name: 'Rook vs Two Pawns',
    description: 'Your rook must stop two passed pawns before they queen.',
    difficulty: 'intermediate',
    materialBalance: 3,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'R' }],
        black: [{ char: 'k' }, { char: 'p', ranks: [2, 4] }, { char: 'p', ranks: [2, 4] }],
        goal: 'Win — stop the pawns and convert your rook.',
      }),
  },
  {
    id: 'rook_vs_pawn',
    name: 'Rook vs Pawn',
    description: 'A rook beats a pawn — but timing and king position matter.',
    difficulty: 'intermediate',
    materialBalance: 4,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'R' }],
        black: [{ char: 'k' }, { char: 'p', ranks: [2, 4] }],
        goal: 'Win — capture the pawn or promote your own threats.',
      }),
  },
  {
    id: 'q_vs_p',
    name: 'Queen vs Advanced Pawn',
    description: 'Stop a pawn one step from promotion using the queen + king technique.',
    difficulty: 'advanced',
    materialBalance: 8,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'Q' }],
        black: [{ char: 'k' }, { char: 'p', ranks: [2, 2] }],
        goal: 'Win — stop the pawn and checkmate.',
      }),
  },
  {
    id: 'n2p_vs_n',
    name: 'Knight + 2 Pawns vs Knight',
    description: 'Convert an extra two pawns with knights on the board.',
    difficulty: 'intermediate',
    materialBalance: 2,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'N' }, { char: 'P', ranks: [2, 6] }, { char: 'P', ranks: [2, 6] }],
        black: [{ char: 'k' }, { char: 'n' }],
        goal: 'Win — push your extra pawns to promotion.',
      }),
  },
  {
    id: 'b2p_vs_b',
    name: 'Bishop + 2 Pawns vs Bishop',
    description: 'Two extra pawns with same-coloured bishops — careful technique wins.',
    difficulty: 'intermediate',
    materialBalance: 2,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'B', squareColor: 'light' }, { char: 'P', ranks: [2, 6] }, { char: 'P', ranks: [2, 6] }],
        black: [{ char: 'k' }, { char: 'b', squareColor: 'light' }],
        goal: 'Win — convert your two extra pawns.',
      }),
  },
  {
    id: 'opp_bishops',
    name: 'Opposite-Coloured Bishops',
    description: 'Famously drawish — learn when an extra pawn is (and is not) enough.',
    difficulty: 'advanced',
    materialBalance: 2,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'B', squareColor: 'light' }, { char: 'P', ranks: [2, 6] }, { char: 'P', ranks: [2, 6] }],
        black: [{ char: 'k' }, { char: 'b', squareColor: 'dark' }],
        goal: 'Try to win two pawns up with opposite bishops.',
      }),
  },
  {
    id: 'q_vs_q_pawn',
    name: 'Queen + Pawn vs Queen',
    description: 'A tricky ending: convert an extra pawn while queens are on.',
    difficulty: 'advanced',
    materialBalance: 1,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: 'Q' }, { char: 'P', ranks: [2, 6] }],
        black: [{ char: 'k' }, { char: 'q' }],
        goal: 'Win — promote your extra pawn, dodging perpetual check.',
      }),
  },
  {
    id: 'minor_vs_pawns',
    name: 'Minor Piece vs 3 Pawns',
    description: 'A classic imbalance — is the piece or the pawns stronger?',
    difficulty: 'intermediate',
    materialBalance: 0,
    generate: () =>
      build({
        white: [{ char: 'K' }, { char: Math.random() < 0.5 ? 'N' : 'B' }],
        black: [{ char: 'k' }, { char: 'p', ranks: [2, 5] }, { char: 'p', ranks: [2, 5] }, { char: 'p', ranks: [2, 5] }],
        goal: 'Hold or win — blockade the pawns with your piece and king.',
      }),
  },
  {
    id: 'random_material',
    name: '🎲 Random (by material)',
    description: 'A fully random endgame at the material advantage you choose with the slider.',
    difficulty: 'intermediate',
    materialBalance: null,
    generate: (opts: GenerateOptions) => {
      const h = opts.handicap
      // Opponent gets a small random base; player gets that + the handicap.
      const oppBase = Math.floor(Math.random() * 4) // 0..3
      const playerVal = Math.max(0, oppBase + h)
      const oppVal = Math.max(0, oppBase + Math.max(0, -h))
      const white: { char: PieceChar }[] = [{ char: 'K' }, ...materialToPieces(playerVal).map((c) => ({ char: c }))]
      const blackPieces = materialToPieces(oppVal).map((c) => c.toLowerCase() as PieceChar)
      const black: { char: PieceChar }[] = [{ char: 'k' }, ...blackPieces.map((c) => ({ char: c }))]
      const sign = h >= 0 ? `+${h}` : `${h}`
      return build({
        white,
        black,
        goal: `Play this random endgame (you are ${sign} in material).`,
      })
    },
  },
]

export function themeById(id: string): EndgameTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

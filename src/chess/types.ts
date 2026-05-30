export type Color = 'w' | 'b'

export interface EndgamePosition {
  fen: string
  /** Which side the human plays. */
  playerColor: Color
  /** Human-readable goal line, e.g. "Win — promote your pawn". */
  goal: string
}

export interface EndgameTheme {
  id: string
  name: string
  /** Short teaching blurb shown under the board. */
  description: string
  /** Rough difficulty for sorting/labelling. */
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  /** Player's material balance in points (for display). null = uses slider. */
  materialBalance: number | null
  /** Generate one fresh, legal, randomized position for this theme. */
  generate: (opts: GenerateOptions) => EndgamePosition
}

export interface GenerateOptions {
  /** Desired player material advantage for the "Random by material" theme. */
  handicap: number
}

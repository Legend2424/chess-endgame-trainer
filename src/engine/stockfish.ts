// Thin wrapper around the single-threaded Stockfish NNUE WASM build.
// Runs entirely in the browser (no server, no per-move network calls).
//
// STRENGTH MODEL — controlled MultiPV selection (not UCI_Elo).
// Stockfish's own UCI_Elo limiter hits a target rating by injecting random
// blunders, so at a fixed "rating" it plays inconsistently and occasionally
// hangs material. That is terrible for endgame training. Instead we:
//   1. Search the position properly with MultiPV (top-N candidate moves + evals).
//   2. Pick among the candidates with a rating-dependent policy: strong ratings
//      almost always play near-best; weaker ratings spread out more — but a hard
//      "blunder cap" that scales with rating means it never gifts a queen. The
//      result is a consistent, calibratable opponent that makes human-scale
//      imperfections rather than catastrophic ones.
// Thinking time (the slider) now only controls how long it ponders, independent
// of strength.

export interface StrengthSettings {
  /** Target opponent strength, ~800–2000. */
  rating: number
  /** Hard cap on thinking time per move, milliseconds. */
  moveTimeMs: number
}

/** A position evaluation from the perspective of the side to move. */
export interface Score {
  cp?: number
  mate?: number
}

interface Candidate {
  move: string
  /** Score from side-to-move perspective, mate mapped to a large cp-equivalent. */
  scoreNum: number
}

type BestMoveCallback = (uci: string) => void

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-nnue-16-single.js`
const MULTIPV = 5

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Map a UCI score to a single comparable number (centipawns), side-to-move POV. */
function scoreToNum(type: 'cp' | 'mate', val: number): number {
  if (type === 'mate') {
    // Closer mates rank higher; being mated ranks very low. Delaying mate (more
    // plies) is preferred when already lost.
    return val > 0 ? 100000 - val * 100 : -100000 - val * 100
  }
  return val
}

export class Engine {
  private worker: Worker | null = null
  private ready = false
  private readyWaiters: Array<() => void> = []
  private onBestMove: BestMoveCallback | null = null
  private onEval: ((s: Score | null) => void) | null = null
  private lastScore: Score | null = null
  private evalQueue: Promise<Score | null> = Promise.resolve(null)
  private strength: StrengthSettings = { rating: 1200, moveTimeMs: 3000 }

  /** When non-null, a play search is in progress and we are collecting candidates. */
  private candidates: Map<number, Candidate> | null = null
  /** Whether this instance uses MultiPV (the playing engine) or not (analysis). */
  private useMultiPV = false

  /** Load the wasm engine and complete the UCI handshake. */
  async init(opts: { multiPV?: boolean } = {}): Promise<void> {
    if (this.worker) return
    this.useMultiPV = !!opts.multiPV
    this.worker = new Worker(ENGINE_URL)
    this.worker.onmessage = (e: MessageEvent) => this.handleLine(String(e.data))
    this.send('uci')
    await this.waitFor('uciok')
    this.send('setoption name Threads value 1')
    this.send('setoption name Hash value 64')
    this.send('setoption name UCI_AnalyseMode value false')
    if (this.useMultiPV) this.send(`setoption name MultiPV value ${MULTIPV}`)
    await this.isReady()
    this.ready = true
    this.readyWaiters.forEach((r) => r())
    this.readyWaiters = []
  }

  /** Resolves once the engine has finished loading. */
  whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve()
    return new Promise((res) => this.readyWaiters.push(res))
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd)
  }

  // --- UCI line handling -------------------------------------------------

  private lineWaiters: Array<{ match: string; resolve: () => void }> = []

  private handleLine(line: string) {
    for (let i = this.lineWaiters.length - 1; i >= 0; i--) {
      if (line.startsWith(this.lineWaiters[i].match)) {
        this.lineWaiters[i].resolve()
        this.lineWaiters.splice(i, 1)
      }
    }

    if (line.startsWith('info') && line.includes(' score ')) {
      const mpvMatch = line.match(/multipv (\d+)/)
      const mpv = mpvMatch ? Number(mpvMatch[1]) : 1
      const sc = line.match(/score (cp|mate) (-?\d+)/)
      const pv = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/)

      // Collect candidate moves for a play search.
      if (this.candidates && sc && pv) {
        this.candidates.set(mpv, {
          move: pv[1],
          scoreNum: scoreToNum(sc[1] as 'cp' | 'mate', Number(sc[2])),
        })
      }
      // Track the best line's score for evaluate() (multipv 1 only).
      if (mpv === 1 && sc) {
        this.lastScore = sc[1] === 'cp' ? { cp: Number(sc[2]) } : { mate: Number(sc[2]) }
      }
    }

    if (line.startsWith('bestmove')) {
      if (this.onEval) {
        const cb = this.onEval
        const s = this.lastScore
        this.onEval = null
        cb(s)
        return
      }
      const fallback = line.split(/\s+/)[1]
      const chosen = this.selectMove() ?? fallback
      const cb = this.onBestMove
      this.onBestMove = null
      this.candidates = null
      if (cb && chosen && chosen !== '(none)') cb(chosen)
    }
  }

  private waitFor(prefix: string): Promise<void> {
    return new Promise((resolve) => {
      this.lineWaiters.push({ match: prefix, resolve })
    })
  }

  private isReady(): Promise<void> {
    this.send('isready')
    return this.waitFor('readyok')
  }

  // --- Strength ----------------------------------------------------------

  setStrength(s: StrengthSettings) {
    this.strength = s
  }

  /** Tunable selection parameters for the current rating. */
  private policy(): { temp: number; cap: number } {
    const t = clamp((this.strength.rating - 800) / (2000 - 800), 0, 1)
    // temp: softmax temperature in centipawns. Low = almost always best move.
    const temp = lerp(220, 18, t)
    // cap: max centipawn loss vs best that is ever allowed. Hard blunder ceiling.
    // 800 -> 350cp (can drop a minor sometimes), 2000 -> 60cp. A queen (~900) is
    // never hung at any rating.
    const cap = lerp(350, 60, t)
    return { temp, cap }
  }

  /** Choose a move from the collected MultiPV candidates per the rating policy. */
  private selectMove(): string | null {
    if (!this.candidates || this.candidates.size === 0) return null
    const cands = [...this.candidates.values()]
    const best = Math.max(...cands.map((c) => c.scoreNum))
    const { temp, cap } = this.policy()
    const pool = cands.filter((c) => best - c.scoreNum <= cap)
    if (pool.length === 0) return cands.find((c) => c.scoreNum === best)?.move ?? null
    const weights = pool.map((c) => Math.exp(-(best - c.scoreNum) / temp))
    const sum = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * sum
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]
      if (r <= 0) return pool[i].move
    }
    return pool[pool.length - 1].move
  }

  // --- Search ------------------------------------------------------------

  newGame() {
    this.send('ucinewgame')
  }

  /** Ask for a move from the given FEN. Calls back with a UCI move string. */
  go(fen: string, cb: BestMoveCallback) {
    this.onBestMove = cb
    this.candidates = this.useMultiPV ? new Map() : null
    this.send(`position fen ${fen}`)
    this.send(`go movetime ${this.strength.moveTimeMs}`)
  }

  /**
   * Evaluate a position to a fixed depth, returning the score from the
   * perspective of the side to move. Calls serialize on this worker, so it's
   * safe to fire several in a row (used by the analysis engine for hints and
   * blunder detection — keep it OFF the playing engine).
   */
  evaluate(fen: string, depth = 12): Promise<Score | null> {
    const task = () =>
      new Promise<Score | null>((resolve) => {
        this.onEval = resolve
        this.lastScore = null
        this.send(`position fen ${fen}`)
        this.send(`go depth ${depth}`)
      })
    this.evalQueue = this.evalQueue.then(task, task)
    return this.evalQueue
  }

  /** Stop the current search (e.g. when the position changes mid-think). */
  stop() {
    this.onBestMove = null
    this.onEval = null
    this.candidates = null
    this.send('stop')
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    this.ready = false
  }
}

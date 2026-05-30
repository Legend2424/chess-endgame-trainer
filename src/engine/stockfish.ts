// Thin wrapper around the single-threaded Stockfish NNUE WASM build.
// Runs entirely in the browser (no server, no per-move network calls).
//
// Strength model (fully adjustable live via setStrength):
//   rating >= 1320 : Stockfish's own limiter — UCI_LimitStrength + UCI_Elo.
//   rating <  1320 : Skill Level + a search-depth cap (Stockfish's Elo limiter
//                    bottoms out around 1320, so we go lower by blunting search).
// Move time is capped separately (~the "seconds per move" the user picks); for
// weak ratings the depth cap usually triggers first, so it also plays fast.

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

type BestMoveCallback = (uci: string) => void

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-nnue-16-single.js`

export class Engine {
  private worker: Worker | null = null
  private ready = false
  private readyWaiters: Array<() => void> = []
  private onBestMove: BestMoveCallback | null = null
  private onEval: ((s: Score | null) => void) | null = null
  private lastScore: Score | null = null
  private evalQueue: Promise<Score | null> = Promise.resolve(null)
  private strength: StrengthSettings = { rating: 1200, moveTimeMs: 3000 }

  /** Load the wasm engine and complete the UCI handshake. */
  async init(): Promise<void> {
    if (this.worker) return
    this.worker = new Worker(ENGINE_URL)
    this.worker.onmessage = (e: MessageEvent) => this.handleLine(String(e.data))
    this.send('uci')
    await this.waitFor('uciok')
    this.send('setoption name Threads value 1')
    this.send('setoption name Hash value 64')
    this.send('setoption name UCI_AnalyseMode value false')
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
    // Track the most recent score reported during a search (for evaluate()).
    if (line.startsWith('info') && line.includes(' score ')) {
      const m = line.match(/score (cp|mate) (-?\d+)/)
      if (m) this.lastScore = m[1] === 'cp' ? { cp: Number(m[2]) } : { mate: Number(m[2]) }
    }
    if (line.startsWith('bestmove')) {
      // An evaluate() search takes priority over a play search on this worker.
      if (this.onEval) {
        const cb = this.onEval
        const s = this.lastScore
        this.onEval = null
        cb(s)
        return
      }
      const uci = line.split(/\s+/)[1]
      const cb = this.onBestMove
      this.onBestMove = null
      if (cb && uci && uci !== '(none)') cb(uci)
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
    const rating = Math.max(600, Math.min(2400, Math.round(s.rating)))
    if (rating >= 1320) {
      this.send('setoption name Skill Level value 20')
      this.send('setoption name UCI_LimitStrength value true')
      this.send(`setoption name UCI_Elo value ${rating}`)
    } else {
      this.send('setoption name UCI_LimitStrength value false')
      // Map 800..1320 -> Skill 0..19
      const skill = Math.max(0, Math.min(19, Math.round(((rating - 800) / (1320 - 800)) * 19)))
      this.send(`setoption name Skill Level value ${skill}`)
    }
  }

  /** Depth cap for sub-1320 play (returns 0 = no cap for stronger ratings). */
  private depthCap(): number {
    const r = this.strength.rating
    if (r >= 1320) return 0
    // 800 -> 2, ~1300 -> ~12.  Low depth = tactically weak = beginner-like.
    return Math.max(2, Math.min(14, Math.round((r - 800) / 45) + 2))
  }

  // --- Search ------------------------------------------------------------

  newGame() {
    this.send('ucinewgame')
  }

  /** Ask for a move from the given FEN. Calls back with a UCI move string. */
  go(fen: string, cb: BestMoveCallback) {
    this.onBestMove = cb
    this.send(`position fen ${fen}`)
    const depth = this.depthCap()
    // NOTE: with "Skill Level" active (weak tier), Stockfish mis-handles a `go`
    // that specifies BOTH depth and movetime (it can return a move for the wrong
    // side). So we send exactly one limit: depth for the weak tier (fast + weak),
    // movetime for the strong tier (UCI_Elo limiter, up to the chosen seconds).
    if (depth > 0) {
      this.send(`go depth ${depth}`)
    } else {
      this.send(`go movetime ${this.strength.moveTimeMs}`)
    }
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
    this.send('stop')
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    this.ready = false
  }
}

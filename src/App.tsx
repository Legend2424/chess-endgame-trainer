import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import Board from './components/Board'
import Controls from './components/Controls'
import { Engine, type Score } from './engine/stockfish'
import { THEMES, themeById } from './chess/endgames'

type Status =
  | { kind: 'loading' }
  | { kind: 'play' }
  | { kind: 'thinking' }
  | { kind: 'over'; text: string }

type Color = 'w' | 'b'
const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w')

// Convert an engine Score (side-to-move perspective) into a single comparable
// number in centipawns, mapping mate distances to large values.
function scoreToNum(s: Score | null): number {
  if (!s) return 0
  if (s.mate !== undefined) return s.mate > 0 ? 100000 - s.mate * 100 : -100000 - s.mate * 100
  return s.cp ?? 0
}

// Win / draw / loss bucket from the player's perspective (centipawns).
type Bucket = 'win' | 'draw' | 'loss'
const WIN_THRESHOLD = 150
function bucketOf(playerCp: number): Bucket {
  if (playerCp >= WIN_THRESHOLD) return 'win'
  if (playerCp <= -WIN_THRESHOLD) return 'loss'
  return 'draw'
}
const bucketRank: Record<Bucket, number> = { loss: 0, draw: 1, win: 2 }

export default function App() {
  const engineRef = useRef<Engine | null>(null) // plays the moves
  const analysisRef = useRef<Engine | null>(null) // evaluates (hints / blunders)
  const gameRef = useRef<Chess>(new Chess())
  const genIdRef = useRef(0) // invalidates stale engine callbacks
  const prevScoreRef = useRef<number | null>(null) // player-perspective eval before their move
  const playerColorRef = useRef<Color>('w') // mirror of state for async callbacks

  const [engineReady, setEngineReady] = useState(false)
  const [themeId, setThemeId] = useState(THEMES[0].id)
  const [handicap, setHandicap] = useState(2)
  const [rating, setRating] = useState(1200)
  const [moveTimeSec, setMoveTimeSec] = useState(3)
  const [defendMode, setDefendMode] = useState(false)

  const [fen, setFen] = useState(gameRef.current.fen())
  const [playerColor, setPlayerColor] = useState<Color>('w')
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [goalText, setGoalText] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [notice, setNotice] = useState<string | null>(null)
  const [ply, setPly] = useState(0)

  const theme = useMemo(() => themeById(themeId), [themeId])

  // --- Engine boot -----------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    const engine = new Engine()
    const analysis = new Engine()
    engineRef.current = engine
    analysisRef.current = analysis
    // The analysis engine plays at full strength (it only ever evaluates).
    analysis.init().then(() => {
      if (!cancelled) analysis.setStrength({ rating: 3000, moveTimeMs: 1000 })
    })
    engine
      .init()
      .then(() => {
        if (cancelled) return
        setEngineReady(true)
        newPosition(themeId, handicap, defendMode)
      })
      .catch((e) => {
        if (cancelled) return
        console.error('Engine failed to load', e)
        setStatus({ kind: 'over', text: 'Engine failed to load. Check console.' })
      })
    return () => {
      cancelled = true
      engine.dispose()
      analysis.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Strength is adjustable live -------------------------------------------
  useEffect(() => {
    if (!engineReady) return
    engineRef.current?.setStrength({
      rating,
      moveTimeMs: Math.min(5000, moveTimeSec * 1000),
    })
  }, [rating, moveTimeSec, engineReady])

  // --- Sync the fen / move count into React ----------------------------------
  const syncBoard = useCallback((game: Chess) => {
    setFen(game.fen())
    setPly(game.history().length)
    const h = game.history({ verbose: true })
    const last = h[h.length - 1]
    setLastMove(last ? [last.from, last.to] : null)
  }, [])

  // --- Baseline eval at the start of the player's turn (for blunder check) ----
  const beginPlayerTurn = useCallback((game: Chess) => {
    setStatus({ kind: 'play' })
    prevScoreRef.current = null
    const analysis = analysisRef.current
    if (!analysis) return
    const myGen = genIdRef.current
    // Player to move => score is already from the player's perspective.
    analysis.evaluate(game.fen()).then((s) => {
      if (myGen === genIdRef.current) prevScoreRef.current = scoreToNum(s)
    })
  }, [])

  // --- Result / draw reporting (defense-aware) -------------------------------
  const reportOrContinue = useCallback((game: Chess): boolean => {
    const defending = defendMode
    if (game.isCheckmate()) {
      const winnerIsPlayer = game.turn() !== playerColorRef.current
      setStatus({
        kind: 'over',
        text: winnerIsPlayer ? '🏆 Checkmate — you win!' : '✖ Checkmate — the engine wins.',
      })
      return true
    }
    if (game.isStalemate()) {
      setStatus({ kind: 'over', text: defending ? '✓ Stalemate — you held the draw!' : '½ Stalemate — draw (watch out for this!).' })
      return true
    }
    if (game.isInsufficientMaterial()) {
      setStatus({ kind: 'over', text: defending ? '✓ Draw — you held it!' : '½ Draw — insufficient material.' })
      return true
    }
    if (game.isDraw()) {
      setStatus({ kind: 'over', text: defending ? '✓ Draw — you held it!' : '½ Draw (50-move / repetition).' })
      return true
    }
    return false
  }, [defendMode])

  // --- Engine move -----------------------------------------------------------
  const askEngine = useCallback((game: Chess) => {
    const engine = engineRef.current
    if (!engine) return
    setStatus({ kind: 'thinking' })
    const myGen = genIdRef.current
    engine.go(game.fen(), (uci) => {
      if (myGen !== genIdRef.current) return // stale (position changed)
      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      const promo = uci.length > 4 ? uci[4] : undefined
      try {
        game.move({ from, to, promotion: promo })
      } catch {
        return
      }
      syncBoard(game)
      if (!reportOrContinue(game)) beginPlayerTurn(game)
    })
  }, [syncBoard, reportOrContinue, beginPlayerTurn])

  // --- Blunder detection on the player's move --------------------------------
  const checkBlunder = useCallback((fenAfterPlayerMove: string) => {
    const analysis = analysisRef.current
    const baseline = prevScoreRef.current
    if (!analysis || baseline === null) return // no baseline ready -> skip quietly
    const myGen = genIdRef.current
    analysis.evaluate(fenAfterPlayerMove).then((s) => {
      if (myGen !== genIdRef.current) return
      // After the player's move it's the opponent to move, so negate to get the
      // player's perspective.
      const afterPlayer = -scoreToNum(s)
      const before = baseline
      const bBefore = bucketOf(before)
      const bAfter = bucketOf(afterPlayer)
      let msg: string | null = null
      if (bucketRank[bAfter] < bucketRank[bBefore]) {
        if (bBefore === 'win' && bAfter === 'draw') msg = '⚠ That lets the win slip — it’s only a draw now.'
        else if (bBefore === 'win' && bAfter === 'loss') msg = '⚠ That throws away the win!'
        else if (bBefore === 'draw' && bAfter === 'loss') msg = '⚠ That gives up the draw.'
      } else if (before - afterPlayer >= 300 && bAfter !== 'loss') {
        msg = '🤔 Inaccuracy — there was a stronger move.'
      }
      setNotice(msg)
    })
  }, [])

  // --- Human move ------------------------------------------------------------
  const onMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const game = gameRef.current
      if (status.kind !== 'play') return false
      let result
      try {
        result = game.move({ from, to, promotion: promotion ?? 'q' })
      } catch {
        return false
      }
      if (!result) return false
      setNotice(null)
      syncBoard(game)

      const playerDeliveredMate = game.isCheckmate()
      if (!playerDeliveredMate) checkBlunder(game.fen())

      if (!reportOrContinue(game)) askEngine(game)
      return true
    },
    [status, syncBoard, checkBlunder, reportOrContinue, askEngine],
  )

  // --- Position setup --------------------------------------------------------
  const newPosition = useCallback(
    (id: string, hcap: number, defend: boolean) => {
      const pos = themeById(id).generate({ handicap: hcap })
      const game = new Chess(pos.fen)
      gameRef.current = game
      genIdRef.current++
      prevScoreRef.current = null
      engineRef.current?.newGame()

      // The generator always builds White as the stronger/active side. When
      // defending, the human takes the weaker side instead.
      const strongColor = pos.playerColor as Color
      const playerCol: Color = defend ? opposite(strongColor) : strongColor
      playerColorRef.current = playerCol
      setPlayerColor(playerCol)
      setGoalText(defend ? 'Defend — hold the draw / survive as long as you can.' : pos.goal)
      setNotice(null)
      syncBoard(game)

      if (game.isGameOver()) {
        setStatus({ kind: 'over', text: 'Generated a finished position — try Randomize again.' })
        return
      }
      if (game.turn() !== playerCol) askEngine(game)
      else beginPlayerTurn(game)
    },
    [syncBoard, askEngine, beginPlayerTurn],
  )

  // --- Takeback --------------------------------------------------------------
  const undo = useCallback(() => {
    const game = gameRef.current
    if (game.history().length === 0) return
    genIdRef.current++ // cancel any in-flight engine search / eval callbacks
    engineRef.current?.stop()
    const playerCol = playerColorRef.current

    game.undo() // undo the most recent ply
    // Step back until it is the player's turn again (removes the engine reply).
    if (game.turn() !== playerCol && game.history().length > 0) game.undo()

    setNotice(null)
    syncBoard(game)

    if (game.isGameOver()) {
      reportOrContinue(game)
    } else if (game.turn() !== playerCol) {
      // Only happens if we rewound to a start where the engine moves first.
      askEngine(game)
    } else {
      beginPlayerTurn(game)
    }
  }, [syncBoard, reportOrContinue, askEngine, beginPlayerTurn])

  // --- Controls handlers -----------------------------------------------------
  const onRandomize = () => newPosition(themeId, handicap, defendMode)
  const onThemeChange = (id: string) => {
    setThemeId(id)
    newPosition(id, handicap, defendMode)
  }
  const onHandicapChange = (h: number) => {
    setHandicap(h)
    if (themeById(themeId).materialBalance === null) newPosition(themeId, h, defendMode)
  }
  const onDefendChange = (d: boolean) => {
    setDefendMode(d)
    newPosition(themeId, handicap, d)
  }
  const flip = () => {
    const c = opposite(playerColorRef.current)
    playerColorRef.current = c
    setPlayerColor(c)
  }

  const orientation = playerColor === 'w' ? 'white' : 'black'
  const interactive = status.kind === 'play'
  const canUndo = engineReady && ply > 0 && status.kind !== 'thinking' && status.kind !== 'loading'

  return (
    <div className="app">
      <header className="app-header">
        <h1>♟ Chess Endgame Trainer</h1>
        <p className="tagline">Practise winning (and holding) endgames against an adjustable engine.</p>
      </header>

      <div className="layout">
        <div className="board-pane">
          <Board
            fen={fen}
            orientation={orientation}
            interactive={interactive}
            onMove={onMove}
            lastMove={lastMove}
          />
          <StatusBar
            status={status}
            goal={goalText}
            playerColor={playerColor}
            engineReady={engineReady}
            notice={notice}
          />
        </div>

        <Controls
          themes={THEMES}
          themeId={themeId}
          onThemeChange={onThemeChange}
          theme={theme}
          handicap={handicap}
          onHandicapChange={onHandicapChange}
          rating={rating}
          onRatingChange={setRating}
          moveTimeSec={moveTimeSec}
          onMoveTimeChange={setMoveTimeSec}
          defendMode={defendMode}
          onDefendChange={onDefendChange}
          onRandomize={onRandomize}
          onUndo={undo}
          canUndo={canUndo}
          onFlip={flip}
          disabled={!engineReady}
        />
      </div>
    </div>
  )
}

function StatusBar({
  status,
  goal,
  playerColor,
  engineReady,
  notice,
}: {
  status: Status
  goal: string
  playerColor: 'w' | 'b'
  engineReady: boolean
  notice: string | null
}) {
  let line: string
  let cls = 'status'
  if (!engineReady || status.kind === 'loading') {
    line = '⏳ Loading engine… (first load downloads ~39 MB, then it is cached)'
  } else if (status.kind === 'thinking') {
    line = '🤖 Engine is thinking…'
    cls += ' thinking'
  } else if (status.kind === 'over') {
    line = status.text
    cls += ' over'
  } else {
    line = `Your move (${playerColor === 'w' ? 'White' : 'Black'}).`
  }
  return (
    <div className="status-wrap">
      <div className={cls}>{line}</div>
      {notice && <div className="notice">{notice}</div>}
      <div className="goal">🎯 {goal}</div>
    </div>
  )
}

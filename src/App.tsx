import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import Board from './components/Board'
import Controls from './components/Controls'
import { Engine } from './engine/stockfish'
import { THEMES, themeById } from './chess/endgames'

type Status =
  | { kind: 'loading' }
  | { kind: 'play' }
  | { kind: 'thinking' }
  | { kind: 'over'; text: string }

export default function App() {
  const engineRef = useRef<Engine | null>(null)
  const gameRef = useRef<Chess>(new Chess())
  const genIdRef = useRef(0) // invalidates stale engine callbacks

  const [engineReady, setEngineReady] = useState(false)
  const [themeId, setThemeId] = useState(THEMES[0].id)
  const [handicap, setHandicap] = useState(2)
  const [rating, setRating] = useState(1200)
  const [moveTimeSec, setMoveTimeSec] = useState(3)

  const [fen, setFen] = useState(gameRef.current.fen())
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w')
  const [lastMove, setLastMove] = useState<[string, string] | null>(null)
  const [goalText, setGoalText] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'loading' })

  const theme = useMemo(() => themeById(themeId), [themeId])

  // --- Engine boot -----------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    const engine = new Engine()
    engineRef.current = engine
    engine
      .init()
      .then(() => {
        if (cancelled) return
        setEngineReady(true)
        newPosition(themeId, handicap)
      })
      .catch((e) => {
        if (cancelled) return
        console.error('Engine failed to load', e)
        setStatus({ kind: 'over', text: 'Engine failed to load. Check console.' })
      })
    return () => {
      cancelled = true
      engine.dispose()
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

  // --- Position setup --------------------------------------------------------
  const newPosition = useCallback((id: string, hcap: number) => {
    const pos = themeById(id).generate({ handicap: hcap })
    const game = new Chess(pos.fen)
    gameRef.current = game
    genIdRef.current++
    engineRef.current?.newGame()
    setPlayerColor(pos.playerColor)
    setFen(game.fen())
    setLastMove(null)
    setGoalText(pos.goal)

    if (game.isGameOver()) {
      setStatus({ kind: 'over', text: 'Generated a finished position — try Randomize again.' })
      return
    }
    // If it's the engine's turn first, let it move.
    if (game.turn() !== pos.playerColor) {
      askEngine(game)
    } else {
      setStatus({ kind: 'play' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      setFen(game.fen())
      setLastMove([from, to])
      reportOrContinue(game, false)
    })
  }, [])

  const reportOrContinue = useCallback((game: Chess, _playerJustMoved: boolean) => {
    if (game.isCheckmate()) {
      const winner = game.turn() === 'w' ? 'Black' : 'White'
      const youWon = (winner === 'White' && playerColor === 'w') || (winner === 'Black' && playerColor === 'b')
      setStatus({ kind: 'over', text: youWon ? '🏆 Checkmate — you win!' : '✖ Checkmate — engine wins.' })
      return
    }
    if (game.isStalemate()) {
      setStatus({ kind: 'over', text: '½ Stalemate — draw.' })
      return
    }
    if (game.isInsufficientMaterial()) {
      setStatus({ kind: 'over', text: '½ Draw — insufficient material.' })
      return
    }
    if (game.isDraw()) {
      setStatus({ kind: 'over', text: '½ Draw (50-move / repetition).' })
      return
    }
    setStatus({ kind: 'play' })
  }, [playerColor])

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
      setFen(game.fen())
      setLastMove([from, to])
      if (game.isGameOver()) {
        reportOrContinue(game, true)
      } else {
        askEngine(game)
      }
      return true
    },
    [status, askEngine, reportOrContinue],
  )

  // --- Controls handlers -----------------------------------------------------
  const onRandomize = () => newPosition(themeId, handicap)
  const onThemeChange = (id: string) => {
    setThemeId(id)
    newPosition(id, handicap)
  }
  const onHandicapChange = (h: number) => {
    setHandicap(h)
    if (themeById(themeId).materialBalance === null) newPosition(themeId, h)
  }
  const flip = () => setPlayerColor((c) => (c === 'w' ? 'b' : 'w'))

  const orientation = playerColor === 'w' ? 'white' : 'black'
  const interactive = status.kind === 'play'

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
          <StatusBar status={status} goal={goalText} playerColor={playerColor} engineReady={engineReady} />
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
          onRandomize={onRandomize}
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
}: {
  status: Status
  goal: string
  playerColor: 'w' | 'b'
  engineReady: boolean
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
      <div className="goal">🎯 {goal}</div>
    </div>
  )
}

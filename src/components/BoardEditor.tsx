import { useEffect, useRef, useState } from 'react'
import { Chessboard, ChessboardDnDProvider, SparePiece } from 'react-chessboard'
import { validateSetup, type PositionObject } from '../chess/generator'

type Color = 'w' | 'b'

interface BoardEditorProps {
  /** Start a game from the built position. */
  onStart: (fen: string, sideToMove: Color) => void
  /** Leave the editor without starting. */
  onCancel: () => void
}

const DARK = '#769656'
const LIGHT = '#eeeed2'
// Both kings are always on the board (you can drag them around but not add or
// remove them), so they are NOT offered in the trays.
const WHITE_PIECES = ['wQ', 'wR', 'wB', 'wN', 'wP']
const BLACK_PIECES = ['bQ', 'bR', 'bB', 'bN', 'bP']

const isKing = (piece?: string) => piece === 'wK' || piece === 'bK'

// A couple of handy presets to start from.
const STANDARD: PositionObject = {
  a8: 'bR', b8: 'bN', c8: 'bB', d8: 'bQ', e8: 'bK', f8: 'bB', g8: 'bN', h8: 'bR',
  a7: 'bP', b7: 'bP', c7: 'bP', d7: 'bP', e7: 'bP', f7: 'bP', g7: 'bP', h7: 'bP',
  a2: 'wP', b2: 'wP', c2: 'wP', d2: 'wP', e2: 'wP', f2: 'wP', g2: 'wP', h2: 'wP',
  a1: 'wR', b1: 'wN', c1: 'wB', d1: 'wQ', e1: 'wK', f1: 'wB', g1: 'wN', h1: 'wR',
}
// The two kings are the permanent baseline the editor always keeps.
const KINGS_ONLY: PositionObject = { e1: 'wK', e8: 'bK' }

export default function BoardEditor({ onStart, onCancel }: BoardEditorProps) {
  const [position, setPosition] = useState<PositionObject>(KINGS_ONLY)
  const [sideToMove, setSideToMove] = useState<Color>('w')
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState(480)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      // Leave room for the two side trays (each ~1 square wide) + gaps, so the
      // board never overflows its container.
      const avail = el.clientWidth
      setWidth(Math.max(240, Math.min(520, Math.round(avail * 0.78))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const spareWidth = Math.round(width / 8)

  // Drag a brand-new piece from a tray onto a square.
  function onSparePieceDrop(piece: string, targetSquare: string): boolean {
    setPosition((prev) => ({ ...prev, [targetSquare]: piece }))
    setError(null)
    return true
  }

  // Move an existing piece to a new square. Kings may be repositioned but never
  // captured: dropping any piece onto a king is rejected.
  function onPieceDrop(sourceSquare: string, targetSquare: string, piece: string): boolean {
    if (sourceSquare === targetSquare) return false
    if (isKing(position[targetSquare]) && !isKing(piece)) return false
    setPosition((prev) => {
      const next = { ...prev }
      delete next[sourceSquare]
      next[targetSquare] = piece
      return next
    })
    setError(null)
    return true
  }

  // Drag a piece off the board to remove it — except the kings, which stay.
  function onPieceDropOffBoard(sourceSquare: string) {
    if (isKing(position[sourceSquare])) return
    setPosition((prev) => {
      const next = { ...prev }
      delete next[sourceSquare]
      return next
    })
    setError(null)
  }

  // Click a piece on the board to delete it (handy on touch). Kings can't be deleted.
  function onSquareClick(square: string) {
    setPosition((prev) => {
      if (!prev[square] || isKing(prev[square])) return prev
      const next = { ...prev }
      delete next[square]
      return next
    })
    setError(null)
  }

  function handleStart() {
    const v = validateSetup(position, sideToMove)
    if (!v.ok || !v.fen) {
      setError(v.error ?? 'That position can’t be played.')
      return
    }
    onStart(v.fen, sideToMove)
  }

  const Tray = ({ pieces }: { pieces: string[] }) => (
    <div className="tray tray-vertical">
      {pieces.map((p) => (
        <SparePiece key={p} piece={p as never} width={spareWidth} dndId="BoardEditor" />
      ))}
    </div>
  )

  return (
    <ChessboardDnDProvider>
      <div className="editor" ref={containerRef}>
        <p className="editor-help">
          Both kings are always on the board (drag them to reposition). Drag the other pieces from
          the side trays onto the board; drag a piece off (or click it) to remove it. Then choose
          who moves first and press <strong>Start game</strong>.
        </p>

        <div className="editor-row">
          <Tray pieces={BLACK_PIECES} />
          <div className="board-container">
            <Chessboard
              id="BoardEditor"
              position={position}
              boardWidth={width}
              onSparePieceDrop={onSparePieceDrop}
              onPieceDrop={onPieceDrop}
              onPieceDropOffBoard={onPieceDropOffBoard}
              onSquareClick={onSquareClick}
              dropOffBoardAction="trash"
              arePiecesDraggable
              customBoardStyle={{ borderRadius: '6px', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}
              customDarkSquareStyle={{ backgroundColor: DARK }}
              customLightSquareStyle={{ backgroundColor: LIGHT }}
              animationDuration={120}
            />
          </div>
          <Tray pieces={WHITE_PIECES} />
        </div>

        {error && <div className="notice">⚠ {error}</div>}

        <div className="editor-controls">
          <div className="row gap">
            <label className="ctrl-label">Who moves first?</label>
          </div>
          <div className="row gap">
            <label className="radio">
              <input type="radio" name="stm" checked={sideToMove === 'w'} onChange={() => setSideToMove('w')} />
              <span>White</span>
            </label>
            <label className="radio">
              <input type="radio" name="stm" checked={sideToMove === 'b'} onChange={() => setSideToMove('b')} />
              <span>Black</span>
            </label>
            <span className="ctrl-hint grow">You’ll play whichever side moves first.</span>
          </div>

          <div className="row gap wrap">
            <button className="btn" onClick={() => { setPosition({ ...STANDARD }); setError(null) }}>Start position</button>
            <button className="btn" onClick={() => { setPosition({ ...KINGS_ONLY }); setError(null) }}>Clear board</button>
          </div>

          <div className="row gap">
            <button className="btn btn-primary big grow" onClick={handleStart}>▶ Start game</button>
            <button className="btn" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </ChessboardDnDProvider>
  )
}

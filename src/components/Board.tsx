import { useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess, type Square } from 'chess.js'

interface BoardProps {
  fen: string
  orientation: 'white' | 'black'
  interactive: boolean
  /** Make a move; returns true if it was legal/accepted. */
  onMove: (from: string, to: string, promotion?: string) => boolean
  /** Squares to highlight as the last move, e.g. ['e2','e4']. */
  lastMove?: [string, string] | null
}

const DARK = '#769656'
const LIGHT = '#eeeed2'
const SELECT = 'rgba(255, 255, 51, 0.5)'
const LASTMOVE = 'rgba(255, 255, 51, 0.35)'

export default function Board({ fen, orientation, interactive, onMove, lastMove }: BoardProps) {
  const game = useMemo(() => new Chess(fen), [fen])
  const [selected, setSelected] = useState<string | null>(null)
  const [width, setWidth] = useState(480)
  const containerRef = useRef<HTMLDivElement>(null)

  // Responsive board sizing.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = Math.max(280, Math.min(640, el.clientWidth))
      setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Clear selection when position changes.
  useEffect(() => setSelected(null), [fen])

  const turnIsOrientation =
    (game.turn() === 'w' && orientation === 'white') ||
    (game.turn() === 'b' && orientation === 'black')

  function legalTargets(square: string): string[] {
    return game
      .moves({ square: square as Square, verbose: true })
      .map((m) => m.to)
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}
    if (lastMove) {
      styles[lastMove[0]] = { background: LASTMOVE }
      styles[lastMove[1]] = { background: LASTMOVE }
    }
    if (selected) {
      styles[selected] = { background: SELECT }
      for (const t of legalTargets(selected)) {
        const isCapture = game.get(t as Square)
        styles[t] = {
          background: isCapture
            ? 'radial-gradient(circle, rgba(0,0,0,0.25) 70%, transparent 72%)'
            : 'radial-gradient(circle, rgba(0,0,0,0.22) 22%, transparent 24%)',
          borderRadius: '50%',
        }
      }
    }
    return styles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, fen, lastMove])

  function tryMove(from: string, to: string, promotion?: string): boolean {
    const ok = onMove(from, to, promotion)
    if (ok) setSelected(null)
    return ok
  }

  function onSquareClick(square: string) {
    if (!interactive || !turnIsOrientation) return
    if (selected && selected !== square) {
      if (legalTargets(selected).includes(square)) {
        tryMove(selected, square)
        return
      }
    }
    const piece = game.get(square as Square)
    if (piece && piece.color === game.turn()) setSelected(square)
    else setSelected(null)
  }

  function onPieceDrop(source: string, target: string, piece: string): boolean {
    if (!interactive || !turnIsOrientation) return false
    // piece is like "wP" / "bQ"; for promotions the dialog passes the chosen piece.
    const promotion = piece && piece.length > 1 ? piece[1].toLowerCase() : 'q'
    return tryMove(source, target, promotion)
  }

  return (
    <div ref={containerRef} className="board-container">
      <Chessboard
        id="endgame-board"
        position={fen}
        boardOrientation={orientation}
        boardWidth={width}
        arePiecesDraggable={interactive && turnIsOrientation}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        customBoardStyle={{ borderRadius: '6px', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}
        customDarkSquareStyle={{ backgroundColor: DARK }}
        customLightSquareStyle={{ backgroundColor: LIGHT }}
        customSquareStyles={squareStyles}
        animationDuration={180}
      />
    </div>
  )
}

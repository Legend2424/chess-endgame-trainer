# Chess Endgame Trainer

A browser-based endgame practice tool for kids (and adults) rated ~1000–1700.
Runs entirely in the browser — Stockfish (WASM) is the opponent, no backend.

## Run it locally

Node.js is installed at `C:\Claude\tools\node` and on your PATH.

- **Easiest:** double-click `start-dev.bat`, then open the `http://localhost:5173` URL it prints.
- **Manual:**
  ```
  npm install      # first time only
  npm run dev      # start dev server
  npm run build    # production build into /dist
  npm run preview  # serve the production build
  ```

## Features

- **Randomized themed endgames** (~16 themes): K+P vs K, two pawns, rook/queen/two-bishop/
  bishop+knight mates, rook vs pawns, queen vs advanced pawn, N+2P vs N, opposite bishops,
  Q+P vs Q, minor vs pawns, and a **🎲 Random (by material)** generator.
- **“Randomize again”** button for a fresh legal position each click.
- **Opponent strength 800–2000**, adjustable live (even mid-game):
  - ≥1320 uses Stockfish's own `UCI_Elo` limiter.
  - <1320 uses `Skill Level` + a search-depth cap (low ratings are approximate — see calibration note).
- **Material handicap −2…+5** (used by the Random-by-material theme).
- **Engine thinking time 1–5 s/move** (applies to the ≥1320 "strong" tier; weak ratings play
  quickly by design — see the engine note below).
- chess.com-style board: drag **and** click-to-move, legal-move dots, last-move highlight,
  and a promotion dialog.
- **Take back** — undo your last move (and the engine's reply) to retry the technique.
- **Defend the worse side** toggle — play the harder side and try to hold the draw ("draw = win");
  result messages adapt so a draw/stalemate is reported as a success.
- **Blunder feedback** — a second, full-strength Stockfish instance evaluates each of your moves
  and warns when you let a win slip or give up a draw, or flags a large inaccuracy.

## Deferred (architected for, not yet built)

- Countdown clock + per-move increment.
- Board editor (drag pieces on/off an empty board) + FEN paste.
- Hint button (best-move arrow) and a win/draw eval bar; tablebase-perfect opponent.

## Engine strength calibration note

The low end (800–1300) is approximate. Stockfish's own Elo limiter only goes down to 1320,
so below that we combine a reduced Skill Level with a shallow search depth. If the engine feels
too strong/weak at a given rating, tune `depthCap()` and the skill mapping in
`src/engine/stockfish.ts`.

**Engine quirk worked around:** with `Skill Level` active, sending a `go` command that specifies
BOTH `depth` and `movetime` makes this Stockfish build occasionally return a move for the wrong
side. So the weak tier sends `go depth N` only (fast + weak), and the strong tier sends
`go movetime N` only (hence the thinking-time slider mainly affects ≥1320 play). Don't recombine
them without re-testing.

**Two engines:** a playing engine (strength-limited) and a separate analysis engine (full
strength) that only ever evaluates positions, so hints/blunder-checks never slow down or weaken
the opponent you're playing.

## Deploying (hosted online)

See `DEPLOY.md` — the repo is wired for **GitHub Pages via GitHub Actions**; every push to `main`
rebuilds and republishes. The single-threaded Stockfish build is used so no special COOP/COEP
headers are needed, and the ~38 MB neural-net file is committed so the engine works on plain
static hosting (cached after first load).

## Project layout

```
src/
  engine/stockfish.ts   Stockfish worker wrapper: strength model + evaluate()
  chess/
    types.ts            shared types
    generator.ts        legal random placement + helpers
    endgames.ts         the theme library
  components/
    Board.tsx           react-chessboard wrapper (drag + click-to-move)
    Controls.tsx        strength / handicap / theme / time / defend / takeback
  App.tsx               state, dual-engine wiring, game flow, blunder check
public/engine/          Stockfish single-threaded WASM build + NNUE net
```

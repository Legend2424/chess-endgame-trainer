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
- **Opponent strength 800–2000**, adjustable live (even mid-game). Uses **MultiPV candidate
  selection** (not Stockfish's `UCI_Elo`) — see the engine note below for why.
- **Countdown clock + increment** — selectable base time (1–30 min, or Off) and per-move
  increment (0–10 s), per side, with flag detection. Changing it restarts the position.
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

- **Set up board** — a drag-and-drop position editor: drag pieces from the white/black trays
  onto the board, drag a piece off (or click it) to remove it, pick who moves first, and press
  **Start game** to play your custom position against the engine. Presets: Kings only, Start
  position, Clear board. Illegal setups (no king, kings touching, pawn on the back rank, side
  not-to-move already in check, already-finished) are blocked with a clear message.

## Deferred (architected for, not yet built)

- FEN paste/export in the board editor.
- Hint button (best-move arrow) and a win/draw eval bar; tablebase-perfect opponent.

## Engine strength model (why not UCI_Elo)

Stockfish's built-in `UCI_Elo` limiter reaches a target rating by **randomly injecting weak
moves**. In practice that means even at 2000 it would, move to move, play wildly inconsistently and
occasionally hang a piece outright (verified: in a trivial K+Q-vs-K win it shuffled the queen
instead of mating). That is a poor opponent for endgame *technique* training.

Instead, the playing engine in `src/engine/stockfish.ts` uses **controlled MultiPV selection**:
1. It searches normally with `MultiPV 5`, getting the top candidate moves and their evaluations.
2. It picks among them with a rating-dependent softmax (`policy()` → `temp`, `cap`):
   - `temp` (softmax temperature) shrinks as rating rises — strong ratings almost always take the
     best move; weak ratings spread out.
   - `cap` is a hard **blunder ceiling** in centipawns vs the best move (≈350cp at 800 → 60cp at
     2000). A move worse than the cap is never chosen, so a queen is never hung at any rating.

The result is a consistent, calibratable opponent that makes human-scale imperfections rather than
catastrophic ones. To retune feel, adjust `temp`/`cap` in `policy()`.

**Two engines:** a playing engine (MultiPV, strength-shaped) and a separate analysis engine (full
strength, `MultiPV 1`) that only ever evaluates positions, so blunder-checks/hints never slow down
or weaken the opponent you're playing.

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

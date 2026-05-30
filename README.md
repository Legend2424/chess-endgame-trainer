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
- The endgame-type list starts with two random options — **🎲 Random endgame** (a different
  classic scenario each time) and **🎲 Random (by material)** — followed by the specific scenarios.
- **Opponent strength 800–2000**, adjustable live (even mid-game). Uses **Skill Level + search
  depth** calibrated to Lichess AI levels — see the engine note below.
- **Countdown clock + increment** — selectable base time (1–30 min, or Off) and per-move
  increment (0–10 s), per side, with flag detection. Shown in a rail to the **left** of the board
  so the board keeps full width. Changing it restarts the position.
- **Evaluation bar** (off by default; tick "Show evaluation bar") — a vertical bar in the left rail
  showing whether the position is winning/drawn/losing, with a short verdict, from the full-strength
  analysis engine.
- **Material handicap −2…+5** (used by the Random-by-material theme).
- **Engine thinking time 1–5 s/move** (a responsiveness cap; depth drives strength).
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
- Hint button (best-move arrow); tablebase-perfect opponent.
- **Real-game endgame library** — optionally seed positions from the
  [Lichess open puzzle database](https://database.lichess.org/) (CC0): millions of FENs tagged with
  an `endgame` theme + difficulty rating, derived from real games. Would let the trainer serve
  authentic, reachable endgames filtered by the rating slider. (Plan: bundle a filtered/trimmed
  subset as a static JSON shipped with the app, since the full CSV is large.)

## Engine strength model (Skill Level + depth)

Two earlier approaches were tried and rejected:
- **`UCI_Elo`** reaches a rating by randomly injecting weak moves, so it played inconsistently and
  occasionally hung material even at 2000.
- A home-grown **MultiPV softmax** picked "a move within X centipawns of best" — but in endgames
  many moves keep the same winning eval while making *no progress* toward mate, so it dawdled and
  felt weak (the "not playing the best move" complaint).

The current model in `src/engine/stockfish.ts` (`ratingToSkillDepth`) maps the 800–2000 slider onto
Stockfish's **Skill Level (0–20) + a fixed search depth**, calibrated against Lichess's published AI
levels (L5 = Skill 7/depth 5 ≈1500, L6 = Skill 11/depth 8 ≈1900, L7 = Skill 15/depth 13 ≈2300):

| Slider | Skill | Depth |
|--------|-------|-------|
| 800    | 1     | 5     |
| 1200   | 8     | 9     |
| 1500   | 11    | 10    |
| 2000   | 20    | 16    |

Crucially the **top of the slider is full Skill 20 at depth 16**, so at 2000 it plays the best move.
`go` sends `depth N movetime cap` together — depth drives strength, the thinking-time slider is a
responsiveness cap (whichever is hit first).

Verified by sampling best-move agreement in KQK / KRK / KPK (5 trials each):
- **2000:** 5/5 best move in all three positions.
- **1500:** 4–5/5.
- **1000:** 2–4/5 (deliberately makes some imperfect-but-legal moves).

To retune feel, adjust the `lerp` endpoints in `ratingToSkillDepth()`.

**Two engines:** a playing engine (Skill+depth) and a separate full-strength analysis engine that
only ever evaluates positions, so blunder-checks/hints never weaken the opponent you're playing.

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

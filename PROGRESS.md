# Session progress / resume notes

Project: `C:\Claude\chess-endgame-trainer` — React+Vite+TS chess endgame trainer.
Node at `C:\Claude\tools\node` (NOT on bash PATH — use PowerShell or absolute
`C:\Claude\tools\node\node.exe`). Dev preview server already runs (port 5173).
Build check: `& "C:\Claude\tools\node\node.exe" node_modules\typescript\bin\tsc -b`
then `... node_modules\vite\bin\vite.js build`.

## CURRENT TASK (in progress)
1. **Add "Show best move" hint** — full-depth best move for the player's side, shown
   as an arrow, for when stuck. Use the full-strength `analysisRef` engine.
2. **Deploy to website** — GitHub Pages workflow already exists at
   `.github/workflows/deploy.yml`; `DEPLOY.md` has steps. User has a GitHub account.
   gh CLI was NOT installed earlier — may need `winget install GitHub.cli`.
   vite.config.ts base uses `process.env.DEPLOY_BASE`. git user = Jacques / djconradie@gmail.com.

## Plan for hint feature
- `src/engine/stockfish.ts`: add `bestMove(fen, depth=18): Promise<string|null>` that
  queues on `evalQueue` (shares worker with evaluate). Add `onBestQuery` resolver;
  in `handleLine` bestmove branch, check `onBestQuery` BEFORE `onEval`.
- `src/App.tsx`: add `hintArrow` state `[from,to]|null`; `onHint` handler calls
  `analysisRef.current.bestMove(fen)` (analysis engine is full strength, rating 3000).
  Clear hint on every move / new puzzle. Pass `hintArrow` to Board.
- `src/components/Board.tsx`: accept `hintArrow?: [string,string]|null`, pass to
  `<Chessboard customArrows={hintArrow ? [[from,to,'#3a8a3a']] : []} />`.
- `src/components/Controls.tsx`: add "💡 Show best move" button (props onHint, disabled
  when not player's turn). Put near Take back / Flip row.

## DONE THIS SESSION (committed, working tree was clean before this task)
- Lichess CC0 puzzle DB integration: `public/puzzles/endgames.json` (~14.5MB, 220k puzzles),
  built by `scripts/process-puzzles.mjs` (uses `fzstd` pure-JS decoder; Node built-in
  zstd FAILS on this file). Source zst at `C:\Claude\_work\puzzles.csv.zst`.
- Categories = Lichess themes (dropdown). `src/chess/puzzleDb.ts` loads + indexes by bitmask.
- Difficulty selector: 5 bands by Lichess rating (Any/VeryEasy<1200/Easy/Medium/Hard/VeryHard2100+),
  `DIFFICULTIES` in puzzleDb.ts, wired through App+Controls. commit b281445.
- Board editor: kings permanent (not in trays, can't delete). commit 7935a4d.
- Eval bar (toggle, left rail), clocks (left rail), takeback, defend mode, blunder feedback.
- Engine strength = Skill Level + depth (ratingToSkillDepth), 800→Skill1/d5, 2000→Skill20/d16.
- Old `src/chess/endgames.ts` = orphaned dead code (not imported).

## SESSION GOTCHAS
- Commit via message FILE (`git commit -F _msg.txt`) then delete it — heredocs/apostrophes
  break in PowerShell. `_*.txt` is gitignored.
- Big PARALLEL tool batches have caused cancel-cascades + a stale-read that corrupted App.tsx.
  Do edits SEQUENTIALLY. Verify with `git diff --numstat` + line counts. Recover with `git checkout`.
- After editing, reload preview with eval `location.reload()` then poll for status != Loading.

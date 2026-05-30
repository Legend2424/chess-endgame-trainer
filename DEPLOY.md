# Deploying to GitHub Pages

This repo is wired for **GitHub Pages via GitHub Actions** (`.github/workflows/deploy.yml`).
Every push to `main` rebuilds and publishes automatically.

## One-time setup

You have a GitHub account already. From a terminal in this folder
(`C:\Claude\chess-endgame-trainer`):

### Option A — using the GitHub CLI (easiest)
```powershell
# Install the CLI once (if you don't have it):
winget install GitHub.cli
# Restart the terminal, then log in (opens your browser):
gh auth login
# Create the repo on your account and push this code:
gh repo create chess-endgame-trainer --public --source . --remote origin --push
# Turn on Pages with the Actions workflow as the source:
gh api -X POST repos/{owner}/chess-endgame-trainer/pages -f build_type=workflow
```

### Option B — plain git + the website
1. On github.com, create a new **empty** public repo named `chess-endgame-trainer`
   (no README/.gitignore — this repo already has them).
2. Back in the terminal:
   ```powershell
   git remote add origin https://github.com/<your-username>/chess-endgame-trainer.git
   git push -u origin main
   ```
3. On github.com → the repo → **Settings → Pages** → under **Build and deployment**,
   set **Source = GitHub Actions**.

## After that

- Watch the **Actions** tab; the first run builds and deploys.
- Your site will be live at `https://<your-username>.github.io/chess-endgame-trainer/`.
- Every future `git push` to `main` redeploys automatically.

## Notes
- The Stockfish neural-net file (~38 MB) is committed so the engine works on a plain static
  host with no special server headers. First load downloads it once, then the browser caches it.
- The build's base path is set automatically from the repo name, so if you name the repo
  something else, Pages still works — just push and it adapts.

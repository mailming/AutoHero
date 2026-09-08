# Arena Training Kit — Setup Runbook

End-to-end guide to run the local bridge server, PostgreSQL database, and Arena Training userscripts for Hero Wars.

## What you are setting up

```
Hero Wars (browser + Tampermonkey)
    │  demo battles, no arena attempts used
    ▼
Arena Training HwH Ext  ──POST──►  llm-bridge-server.mjs  (:9876)
LLM Controller HwH Ext  ◄─poll──                              │
    │                                                           ▼
    └── requires HeroWarsHelper.user.js              PostgreSQL (autohero DB)
```

| Component | Role |
|-----------|------|
| **HeroWarsHelper.user.js** | Base script — APIs, battle calc, menu |
| **LLM Controller HwH Ext** | Polls bridge; exposes `window.LLMHWH` |
| **Arena Training HwH Ext** | Simulates combos vs top arena defenses; saves to DB |
| **llm-bridge-server.mjs** | Local HTTP server on `127.0.0.1:9876` |
| **PostgreSQL** | Stores opponent combos, your combos, win rates |

---

## Prerequisites

- **Windows 10/11** (steps below use PowerShell; adapt for macOS/Linux)
- **Node.js 18+** — [https://nodejs.org](https://nodejs.org)
- **Tampermonkey** browser extension
- **Hero Wars** account in browser ([hero-wars.com](https://www.hero-wars.com))
- Git (optional, for cloning)

---

## 1. Get the project

```powershell
git clone https://github.com/mailming/AutoHero.git
cd AutoHero
git checkout develop
```

Or download the repo as a ZIP and extract it.

Install Node dependencies:

```powershell
npm install
```

---

## 2. Install PostgreSQL

### Option A — winget (recommended on Windows)

```powershell
winget install PostgreSQL.PostgreSQL.17
```

During setup, note the **postgres user password** you choose.

### Option B — installer

Download PostgreSQL 17 from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/) and install with default options.

### Create the database

Open **SQL Shell (psql)** or PowerShell:

```powershell
# If psql is on PATH (adjust version folder if needed):
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE autohero;"
```

---

## 3. Configure the database connection

Copy the example env file and edit the password if needed:

```powershell
copy .env.example .env
notepad .env
```

Example `.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/autohero
```

Default (if no `.env`): `postgresql://postgres:postgres@localhost:5432/autohero`

Initialize tables:

```powershell
npm run db:init
```

Expected: no errors; creates `opponent_combos`, `matchup_tests`, `training_rounds`.

---

## 4. Run PostgreSQL

PostgreSQL usually runs as a Windows service after install.

Check status:

```powershell
Get-Service postgresql*
```

Start if stopped:

```powershell
Start-Service postgresql-x64-17   # name may vary; check Get-Service postgresql*
```

Verify connection:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d autohero -c "SELECT 1;"
```

---

## 5. Run the bridge server

From the project folder:

```powershell
npm run bridge
```

Or:

```powershell
node llm-bridge-server.mjs
```

Expected output:

```
PostgreSQL connected: postgresql://postgres:****@localhost:5432/autohero
LLM bridge listening on http://127.0.0.1:9876
Arena training: GET /training/view (HTML), /training/results (JSON), /training/matchups
Waiting for Hero Wars tab (LLM Controller) to poll /poll ...
```

Leave this terminal open while training.

### Health check

```powershell
Invoke-RestMethod http://127.0.0.1:9876/health
```

Look for `"database": { "ready": true }`.

### Port already in use

```powershell
netstat -ano | findstr ":9876"
Stop-Process -Id <PID> -Force
```

Then restart the bridge.

---

## 6. Install the Arena Training kit (browser)

Install scripts in **Tampermonkey** in this order. All must be **enabled** on Hero Wars URLs.

### 6.1 Base script (required)

Install **HeroWarsHelper.user.js** from the repo (Tampermonkey → Create new script → paste file contents, or use a raw GitHub URL).

Arena Training depends on `HWHClasses`, `Send`, `cheats.BattleCalc`, and `HWHFuncs` from this script.

### 6.2 LLM Controller (required for bridge + PowerShell control)

Install **LLM Controller HwH Ext.user.js**

- Raw URL: `https://github.com/mailming/AutoHero/raw/refs/heads/develop/LLM%20Controller%20HwH%20Ext.user.js`
- Polls `http://127.0.0.1:9876/poll` so the bridge can run commands in-game

### 6.3 Arena Training (required)

Install **Arena Training HwH Ext.user.js**

- Raw URL: `https://github.com/mailming/AutoHero/raw/refs/heads/develop/Arena%20Training%20HwH%20Ext.user.js`
- Runs demo battles and saves results to PostgreSQL via the bridge

### 6.4 Load the game

1. Open [https://www.hero-wars.com](https://www.hero-wars.com) and log in
2. Wait for the HWH menu to appear
3. Confirm bridge connection:

```powershell
Invoke-RestMethod http://127.0.0.1:9876/health
# browserConnected should become true after the tab loads
```

---

## 7. Run Arena Training

### Option A — In-game menu

Click **Arena Train** in the HWH menu (starts loop training with defaults).

### Option B — Browser console

```javascript
// Continuous loop vs arena top-list defenses
arenaTrainingStartLoop({
  topLimit: 12,           // hero pool size for generated combos
  opponentSource: 'topGet'
});

// Stop
arenaTrainingStopLoop();
```

### Option C — PowerShell (bridge must be running, game tab open)

```powershell
.\loop-arena-training.ps1 -TopLimit 12 -HeroPoolSize 12
```

Single round only:

```powershell
.\run-arena-training.ps1 -OpponentIndex 0 -HeroPoolSize 12
```

### Default training behavior (v1.9+)

| Setting | Default |
|---------|---------|
| Simulations per combo | 10 demo battles |
| Target win rate | 80% (stop when found) |
| Test order | Arena team → 3 Grand Arena teams → meta teams (DB) → generated combos |
| Skip cached opponents | Yes — skip if DB has ≥80% counter within 30 days |
| Opponent source | Arena top 50 via `topGet` |
| Arena attempts used | **None** (demo battles only) |

---

## 8. View results

| URL | Description |
|-----|-------------|
| [http://127.0.0.1:9876/](http://127.0.0.1:9876/) | HTML table — opponent combo, your combo, win %, last tested |
| [http://127.0.0.1:9876/training/results?limit=100](http://127.0.0.1:9876/training/results?limit=100) | JSON API |
| [http://127.0.0.1:9876/training/summary](http://127.0.0.1:9876/training/summary) | Counts and latest matchup |

PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:9876/training/summary
Invoke-RestMethod "http://127.0.0.1:9876/training/skip-check?comboKey=7,64,17,12,50|6006|1"
```

---

## 9. Scrape meta arena teams (hw-recruit)

Collect popular arena defense teams from [hw-recruit.com](https://hw-recruit.com/arena) and store each run as a **timestamped snapshot** in PostgreSQL.

Each run creates:
- `meta_team_snapshots` — capture time, pages scraped, team counts
- `meta_teams` — hero combo, banner, popularity count, row rank

```powershell
pip install -r requirements.txt
npm run db:init
npm run db:scrape-meta-teams
```

Options:

```powershell
# Top-10 arena meta only, first 5 pages (quick test)
python scrape_meta_teams_to_db.py --position 10 --max-page 5

# Full scrape until empty pages (can take a while)
python scrape_meta_teams_to_db.py --position 10 --max-page 0

# Scrape without writing to DB
python scrape_meta_teams_to_db.py --max-page 1 --dry-run
```

View via bridge API:

```powershell
Invoke-RestMethod http://127.0.0.1:9876/training/meta-snapshots
Invoke-RestMethod "http://127.0.0.1:9876/training/meta-teams?snapshotId=1"
Invoke-RestMethod "http://127.0.0.1:9876/training/meta-candidates?limit=10"
```

Arena Training (v1.11+) fetches meta candidates from `/training/meta-candidates` (latest snapshot by default). Combos are filtered to heroes you own, ordered by popularity, and tested in **Phase 3** after grand arena teams.

**HTML table:** [http://127.0.0.1:9876/training/meta-view](http://127.0.0.1:9876/training/meta-view)

---

## 10. Optional maintenance

### Import old JSON results

If you have files in `arena-training-results/`:

```powershell
npm run db:import-json
```

### Backfill matchup tables from legacy rounds

```powershell
npm run db:backfill-matchups
```

### Remove low win-rate rows (example: below 60%)

```powershell
node -e "
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/autohero' });
const r = await pool.query('DELETE FROM matchup_tests WHERE win_rate < 60');
console.log('Deleted', r.rowCount, 'rows');
await pool.end();
"
```

---

## 11. Troubleshooting

| Problem | Fix |
|---------|-----|
| `Database not ready` | Start PostgreSQL; check `DATABASE_URL` in `.env`; run `npm run db:init` |
| `browserConnected: false` | Open Hero Wars tab; ensure LLM Controller + HeroWarsHelper are enabled in Tampermonkey |
| Bridge save warnings | Confirm bridge is running on port 9876 |
| Port 9876 in use | Kill old `node llm-bridge-server.mjs` process (see §5) |
| Training never starts | Check console for errors; ensure `cheats.BattleCalc` is available (base HWH loaded) |
| Skip-check not working | Restart bridge after updates; reload Arena Training userscript |
| CORS / fetch errors to localhost | Use same machine for browser and bridge; URL must be `127.0.0.1:9876` |

### Useful console checks (in-game)

```javascript
window.ArenaTraining?.getStatus()
window.LLMHWH?.arenaTrainingGetStatus()
window.cheats?.translate('LIB_HERO_NAME_55')  // should return 'Iris'
```

---

## 12. Daily startup checklist

1. Start PostgreSQL (usually automatic)
2. `cd AutoHero` → `npm run bridge`
3. Open Hero Wars in browser (logged in)
4. Confirm `Invoke-RestMethod http://127.0.0.1:9876/health` → `browserConnected: true`
5. Start training (menu, console, or `loop-arena-training.ps1`)
6. Monitor [http://127.0.0.1:9876/](http://127.0.0.1:9876/)

---

## File reference

| File | Purpose |
|------|---------|
| `llm-bridge-server.mjs` | HTTP bridge + training routes |
| `training-db.mjs` | PostgreSQL schema and queries |
| `training-view.mjs` | HTML results page |
| `hero-names.mjs` | Hero/pet ID → name mapping |
| `loop-arena-training.ps1` | Start loop via PowerShell |
| `run-arena-training.ps1` | Single training round via PowerShell |
| `scrape_meta_teams_to_db.py` | Scrape hw-recruit meta teams into PostgreSQL snapshots |
| `.env` | `DATABASE_URL` (not committed; copy from `.env.example`) |

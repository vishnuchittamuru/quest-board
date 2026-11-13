# ⚔️ Aethoria Guildhall v2 — Encrypted Terminal Quest Board

A zero-dependency, **AES-256-GCM encrypted** RPG Quest Board & Habit Tracker for the terminal. Built with pure Node.js (`node:crypto`, `node:fs`, `node:readline`) with 24-bit truecolor rendering and automatic 256-color fallback.

---

## ✨ What's in v2

### 1. Three Interactive Board Layouts (`F1` / `F2` / `F3`)
- **Always-Visible Date & Atmosphere Banner**: Shows the current date, time-of-day lighting phase, seasonal event, NPC companion, and Daily Commission Chest meter across every layout.
- **`[F1]` Classic Guild Board**: Split-pane Notice Board, **Active Quest Pouch**, **Daily Rituals** tab, **Hall of Legends**, numbered Category (`Tab`) filter pills, and live **Daily Rituals Pulse Bar**.
- **`[F2]` War Table (Kanban by Realm)**: Side-by-side columns with a pinned **Daily Rituals** column (`y`), **Realm Health** bars, `[DUSTY]` warnings on neglected realms (7+ days), and `<` / `>` card movement between Realms.
- **`[F3]` Battle Arena (Focus Mode + Pomodoro)**: Fight your selected quest or ritual as a procedurally generated ASCII Monster (or grow it from Seed to Radiant Bloom in *Cozy Cottage*!), complete with timed **Pomodoro Focus Rounds**, sub-step attack moves, and a timestamped **Combat Log**.

### 2. Repeating Items & Daily Rituals (`y` & `P`)
- Track repeating habits like **Drink Water (8/8 charges)**, **Workout**, **10-Min Clean**, **Study**, or custom routines with cadences (`Daily`, `Weekdays`, `Weekends`, `Weekly`, `Every 3 Days`). Daily items automatically rotate and reset at midnight.
- **Mastery Chains**: Consecutive completions build **Bronze ★ (3d)** → **Silver ★★ (7d)** → **Gold ★★★ (14d)** → **Mythic ✦ (30d)** multipliers.
- **Daily Commission Supply Chest**: Completing your daily rituals opens a bonus chest (`+60 XP`, `+30 Gold`, + Relic roll).
- **Recurring Board Quests (`R`)**: Toggle repeat cadences on regular board quests so completed weekly chores respawn automatically.

### 3. Biomes, Wizards & Dual-Language Help (`t`, `n`, `e`, `?`)
Each Biome transforms **colors, box borders, vocabulary, NPC companion, progress metaphors, add/edit wizards, and ambient particles**:
- **Tavern Hearth** (Default) — Guildmaster Garrick, drifting embers
- **Neon Syndicate** — Fixer AI NYX, cyberpunk `Gigs` & `Creds`, digital rain
- **Cozy Cottage** — Granny Owl, falling petals, quests *sprout and bloom* instead of losing HP
- **Pirate Cove** — Captain Polly, `Bounties` & `Doubloons`, ocean swells
- **Phosphor CRT** — Distraction-free monochrome green terminal

Stacked dynamic modifiers: **Streak Heat Borders** (Iron → Bronze → Gold → Animated Flame), **Time-of-Day Lighting** (`Dawn`, `Daylight`, `Dusk`, `Starlight`), and **Seasonal Calendar Events** (*Frostfall*, *Spring Bloom*, *Midsummer Nights*, *Harvest Moon*) with seasonal Relics.
Press **`?`** anytime for the **Field Manual**, showing every hotkey for `[F1]`, `[F2]`, `[F3]`, and Global keys side-by-side in **Theme Language** and **Normal Language**.

### 4. Security & Planned Rest
- **AES-256-GCM + `scrypt` Encryption**: Vault stored safely in `.quest-vault.enc.json` (ignored by `.gitignore`).
- **Planned Tavern Leave (`v`)**: Protect both your Hero streak and Daily Ritual chains ahead of time when stepping away or going on vacation.

---

## 🚀 Quick Start

```powershell
cd quest-board
.\quest
# or: npm start
# or: node quest-board.js --no-anim
```

---

## ⌨️ Interactive Hotkeys

| Key | Action |
| :--- | :--- |
| `F1` / `F2` / `F3` | Switch Layout: **Classic Board** (`F1`), **War Table Kanban** (`F2`), **Battle Arena** (`F3`) |
| `↑/↓/←/→` or `h/j/k/l` | Navigate quests, rituals, and War Table columns |
| `Space` | Pick into Active Pouch · Strike/Charge Daily Ritual · Direct Strike in Arena |
| `1` – `9` | Strike sub-step #1–9 (deals Boss HP damage with Critical Hit rolls) |
| `c` | Complete / Slay selected quest or complete ritual |
| `Enter` | Enter **Battle Arena** on selected item (or Final Blow while in Arena) |
| `y` / `P` | Open **Daily Rituals** (`y`) · Quick-Add **Ritual Presets** (`P`) |
| `b` / `p` / `a` | Switch Classic tabs (`b` Board, `p` Pouch, `a` Hall of Legends) · On `F2`/`F3`, `a` opens Legends popup |
| `Tab` / `Shift+Tab` | Cycle **Realm / Group** filter forward or backward |
| `<` / `>` | Move quest card to previous/next Realm on the **War Table** |
| `f` / `\` / `F` | Battle Arena Pomodoro: Start/Pause (`f`), Cycle 15/25/45m (`\`), Finish Round (`F`) |
| `d` | **Roll the d20 of Fate** (1.5x–2.0x Bounty) |
| `n` / `s` / `m` / `e` / `x` | New item with numbered group picker (`n`), +Sub-step (`s`), +Note (`m`), Edit (`e`), Delete (`x`) |
| `r` / `R` | Cycle Rank `S–D` (`r`) · Toggle Quest Repeat Cadence (`R`) |
| `v` / `i` / `t` | **Tavern Leave** (`v`), **Reliquary** (`i`), **Biomes & Atmosphere** (`t`) |
| `K` / `?` / `q` | Change Passphrase (`K`), Dual-Language Help Manual (`?`), Save & Quit (`q`) |

---

## ⚡ Quick CLI One-Liners

```powershell
# Summary of Hero, Daily Rituals, Active Pouch & Board
.\quest list

# Daily Rituals CLI
.\quest ritual list
.\quest ritual add "Drink Water" --count 8 --cadence daily --realm Homestead
.\quest ritual hit "Drink Water"

# Post a recurring or one-time quest
.\quest add "Refactor Auth Service" --rank A --realm "Craft & Code" --steps "Audit,Patch,Test" --repeat weekly --active

# Roll for Fate or schedule Tavern Leave
.\quest fate
.\quest leave 5
```

# ⚔️ Aethoria Guildhall — Encrypted Terminal Quest Board

A zero-dependency, **AES-256-GCM encrypted** RPG Quest Board for the terminal. Built with pure Node.js (`node:crypto`, `node:fs`, `node:readline`) so it runs out of the box with no external packages required.

---

## ✨ Features

- **🔐 Password-Protected Encrypted Vault**: All quests, notes, and hero progression are stored in a clean JSON envelope (`.quest-vault.enc.json`) encrypted with `scrypt` key derivation and authenticated `AES-256-GCM`.
- **🎒 Active Quest Pouch (Daily Loadout)**: Pick 3–5 quests from the **Guild Notice Board** into your **Active Quest Pouch** for today's run. Clearing your active pouch triggers a **Daily Full-Clear Combo** with bonus XP, Gold, and streak progression.
- **🏷️ Guild Priority Ranks (`S` / `A` / `B` / `C` / `D`)**: Prioritize tasks by threat level, from `[S-Rank] Mythic Calamity` down to `[D-Rank] Quick Errand`, scaling XP, Gold, and Relic drop rates.
- **🗺️ Realms & Grouping**: Organize quests into customizable Realms (e.g., *Main Campaign*, *Craft & Code*, *Arcane Study*, *Homestead*) and cycle filters with `Tab`.
- **❤️ Boss HP Bars & Sub-Quest Strikes**: Break complex tasks into sub-steps that form an ASCII Boss HP bar. Press `1`–`9` to strike sub-steps, land Critical Hits, and drain the boss's HP!
- **📜 Lore & Field Notes**: Attach timestamped details and notes to any quest scroll.
- **🎲 Roll the d20 of Fate (`d`)**: Can't decide what to work on? Roll an animated ASCII d20 to let the board assign a quest with a **1.5x XP & Gold Bounty** (or **2.0x Mythic Bounty + guaranteed Relic** on a Natural 20!).
- **🏕️ Planned Tavern Leave / Vacation Mode (`v`)**: Pause questing ahead of time for 1, 3, 7, 14, or custom days when going on vacation so your streak stays 100% protected while you rest.
- **🦉 Interactive NPC Guildmaster, Relics & Themes**: Dynamic commentary from Guildmaster Garrick, 8 collectible ASCII Relics with passive buffs (`l`), and 6 unlockable terminal color themes (`t`).

---

## 🚀 Quick Start

```powershell
cd D:\Dev\Base1\repos\quest-board

# Launch the interactive full-screen TUI
.\quest
# or
npm start
# or
node quest-board.js
```

*(Optional)* To make `quest` available globally from any directory on your machine:
```powershell
npm link
```

---

## ⌨️ Interactive TUI Hotkeys

| Key | Action |
| :--- | :--- |
| `↑` / `↓` or `k` / `j` | Navigate quests |
| `Space` | Embark / Un-embark quest into **Today's Active Quest Pouch** |
| `b` / `p` / `a` | Switch view: **Guild Board** (`b`), **Active Pouch** (`p`), **Hall of Legends** (`a`) |
| `Tab` | Cycle **Realm / Group** filter |
| `1` – `9` | Strike sub-step #1–9 (deals Boss HP damage & awards chip XP) |
| `c` or `Enter` | **Slay / Complete** selected quest for XP, Gold & Loot rolls |
| `u` | Re-open a completed quest from the Hall of Legends |
| `d` | **Roll the d20 of Fate** (assigns a random open quest with a 1.5x–2.0x Bounty) |
| `n` | Post a **New Quest Scroll** |
| `s` / `m` | Add a **Sub-step** (`s`) or **Field Note** (`m`) to the selected quest |
| `r` | Cycle priority rank (`S` → `A` → `B` → `C` → `D`) |
| `o` | Cycle sort order (`rank` → `hp` → `newest`) |
| `e` / `x` | Edit quest scroll (`e`) or Delete quest (`x`) |
| `v` | **Tavern Leave (Vacation Mode)** — protect your streak for N days |
| `l` / `t` | Open **Reliquary Loot Vault** (`l`) or **Visual Themes** (`t`) |
| `K` | Change Vault Encryption Passphrase |
| `?` / `q` | Help Manual (`?`) / Save & Quit (`q`) |

---

## ⚡ Quick CLI One-Liner Commands

```powershell
# View Hero status, Active Quest Pouch & Guild Board
.\quest list

# Post a quest directly from the terminal
.\quest add "Slay the authentication bug" --rank A --realm "Craft & Code" --steps "Reproduce,Write test,Fix" --note "Check token TTL" --active

# Roll the d20 of Fate from the CLI
.\quest fate

# Schedule Tavern Leave for 5 days (or 0 to resume early)
.\quest leave 5

# Complete a quest by title substring or ID
.\quest done "authentication bug"
```

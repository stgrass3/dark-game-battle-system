# DARK GAME - Imagination Battle System Design

## Overview

DARK GAME is a **facilitation tool** for imagination-based card battles, not a rules engine. Players narrate attacks using cards as COMPONENTS and debate outcomes peer-to-peer. The system enforces turn order, displays cards, prompts passive effects, logs narrative, and supports debate resolution.

**Core Principle:** No damage calculation, no card rarity, no battle mechanics. Battle is 100% player imagination.

---

## 1. Lobby & Room System

### Room Creation
- **UI:** Create Room panel with:
  - Player name input
  - Language selector (中文 / EN)
  - "Draw Cards" button to generate random hand
  - "Ready" button to enter waiting state
- **Generated Hand:** 1 Race + 1 Weapon + 3 Abilities + 1 Entity/Summon
- **Room Code:** 6-character alphanumeric code for sharing

### Room Waiting
- Display waiting room with drawn hand
- Show room code prominently
- "Copy Room Code" button
- "Leave Room" button
- Opponent join notification

### Room Join
- Join by room code input
- Display both players' hands in arena layout

---

## 2. Battle Phase

### Layout
- **Two fighter panels** (P1 left/cyan, P2 right/crimson)
- **Each fighter shows:**
  - Name
  - Race card (top)
  - Weapon card
  - 3 Ability cards
  - Entity/Summon card
  - Passive effects list (highlighted when triggered)
- **Center:** Environment card & Current turn indicator
- **Bottom:** Action buttons + Narrative input
- **Combat Log:** Right sidebar for narrative exchange

### Turn Management
- Current player's panel glows/pulses
- Actions available to current player:
  - **描述攻擊 / Describe Attack** - Opens narrative textarea
  - **結束回合 / End Turn** - Pass turn to opponent
  - **被動觸發被動 / Trigger Passive** - Shows passive prompt
- Opponent's panel is dimmed
- 5-minute auto-pass timer (optional warning at 4min)

### Narrative Exchange
- Textarea for current action description
- "送出 / Submit" button
- Submitted text appears in Combat Log with timestamp
- Log format: `[Player]: [Narrative text]`

---

## 3. Passive Effect System

### Passive Detection
- Cards with passive keywords trigger prompts:
  - `舔血`: "舔血 glows! You are damaged - describe getting stronger"
  - `吸收`: "吸收 activated! Describe absorbing [element]"
  - `再生`: "再生 in effect! Describe regeneration"
  - `反彈`: "反彈 triggered! Describe reflecting [attack/condition]"
  - `閃避`: "閃避 ready! Describe evading"

### Passive Display
- Passive keywords highlighted on card
- Floating indicator when passive triggers
- Click to dismiss or expand prompt

---

## 4. Debate Mode

### Triggering Debate
- Either player can flag opponent's narrative for debate during opponent's turn only
- Click `[DEBATE]` button next to combat log entry
- Debate notification appears for flagging player

### Debate UI
- Overlay appears with:
  - Split view: Attacker's version vs Defender's version
  - Debater chat panel
  - `[Counts]` and `[Void]` buttons

### Resolution
- **Counts (算我赢):** Attacker's narrative stands
- **Void (不算):** Attacker's narrative is nullified
- Result logged, overlay closes, game resumes
- Resolution text: "Player X: Counts" or "Player X: Void"

---

## 5. Victory Conditions

### Types
- **投降 / Surrender:** Player clicks "投降/投降" button → immediate loss
- **死亡 / Death:** Player declares own death in narrative → immediate loss
- **自爆 / Self-Sacrifice:** Player describes self-destruction → immediate loss

### Victory Screen
- Victory overlay with winner announcement
- "再來一局 / Rematch" button
- "返回大廳 / Return to Lobby" button
- Final combat log summary

---

## 6. Environment Display

- Selected Place card shown at arena center
- Affects narrative atmosphere (visual only)
- Some cards reference environment (e.g., 月亮龍)

---

## 7. Language Support

### Bilingual UI
- Toggle switch: 日本語/EN
- All UI text bilingual:
  - `結束回合` / `End Turn`
  - `投降` / `Surrender`
  - `死亡` / `Death`
  - `描述攻擊` / `Describe Attack`
  - 被動觸發 / `Trigger Passive`
- Card names remain in original language (Japanese/Chinese)

---

## 8. Rules Page

### Content
1. Introduction to DARK GAME
2. Card Types explanation
3. Turn Structure
4. Passive Effects
5. Debate System
6. Victory Conditions
7. Tips for Imagination Battles

---

## 9. Technical Implementation

### Frontend
- `battle.html` - Complete arena interface
- `index.html` - Card showcase & lobby
- `rules.html` - Rules page
- CSS with dark theme, glow effects
- Vanilla JS for interactivity

### Backend (Minimal)
- Card pool data store
- Room state management (in-memory)
- No battle logic needed

### API Routes
```
/api/pools - Get all card pools
/api/draw/hand - Draw random 6-card hand
/api/room/create - Create battle room
/api/room/:code - Get room state
/api/room/:code/action - Submit narrative action
/api/room/:code/debate - Flag debate / resolve
```

---

## 10. Component Status

- [x] 牌池系統 (Card pools)
- [x] 隨機抽卡 (Random card draw)
- [x] 暗色主題 UI (Dark theme UI)
- [ ] 房間系統 (Room/lobby system)
- [ ] 戰鬥介面 (Battle arena)
- [ ] 被動觸發提示 (Passive effect prompts)
- [ ] 辯論模式 (Debate mode)
- [ ] 勝敗結算 (Victory/defeat)
- [ ] 雙語介面 (Bilingual UI)
- [ ] 規則頁面 (Rules page)
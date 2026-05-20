# DARK GAME - Imagination Battle System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a facilitation tool for imagination-based card battles with turn management, card display, debate mode, and bilingual support.

**Architecture:** Full frontend-heavy system with minimal Express backend. The backend manages only rooms/state, displaying cards, and logging narrative. No battle mechanics, damage calculation, or win-condition enforcement—players use the tool to facilitate their imagination-based duels.

**Tech Stack:** Express.js, Vanilla JS, HTML/CSS, in-memory room state

---

## File Structure

```
c:\Dark Game Battle System\
├── src/
│   ├── server.js           (modify: replace game routes with room routes)
│   └── game/
│       └── GameManager.js  (modify: remove battle logic, add room management)
├── public/
│   ├── index.html          (modify: add lobby/room UI, draw-on-demand)
│   ├── battle.html         (modify: complete battle interface)
│   └── rules.html          (create: rules page)
└── docs/superpowers/
    ├── specs/2026-05-19-dark-game-design.md
    └── plans/2026-05-19-dark-game-implementation.md
```

---

## Task 1: Backend - Room Management APIs

**Files:**
- Modify: `src/game/GameManager.js` (complete rewrite)
- Modify: `src/server.js` (replace game routes)

- [ ] **Step 1: Rewrite GameManager for room management**

Replace entire content of `src/game/GameManager.js`:

```javascript
function generateId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

class Player {
    constructor(id, name, hand) {
        this.id = id;
        this.name = name;
        this.hand = hand;
        this.ready = false;
        this.declaredDeath = false;
    }
}

class Room {
    constructor(code) {
        this.code = code;
        this.player1 = null;
        this.player2 = null;
        this.currentTurn = 'p1';
        this.turnNumber = 1;
        this.narrativeLog = [];
        this.debateActive = false;
        this.debateLog = [];
        this.phase = 'lobby';
        this.winner = null;
        this.createdAt = Date.now();
    }

    isFull() { return this.player1 !== null && this.player2 !== null; }
    getCurrentPlayer() { return this.currentTurn === 'p1' ? this.player1 : this.player2; }
    getOpponent(playerId) {
        if (this.player1?.id === playerId) return this.player2;
        if (this.player2?.id === playerId) return this.player1;
        return null;
    }
}

class GameManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(playerName, hand) {
        const roomCode = generateRoomCode();
        const playerId = generateId();
        const room = new Room(roomCode);
        room.player1 = new Player(playerId, playerName, hand);
        this.rooms.set(roomCode, room);
        return { room, playerId };
    }

    joinRoom(roomCode, playerName, hand) {
        const room = this.rooms.get(roomCode.toUpperCase());
        if (!room) return { error: 'Room not found' };
        if (room.isFull()) return { error: 'Room is full' };
        const playerId = generateId();
        room.player2 = new Player(playerId, playerName, hand);
        room.phase = 'ready';
        return { room, playerId };
    }

    getRoom(code) {
        return this.rooms.get(code.toUpperCase());
    }

    submitNarrative(roomCode, playerId, text) {
        const room = this.rooms.get(roomCode.toUpperCase());
        if (!room) return { error: 'Room not found' };
        const player = room.getCurrentPlayer();
        if (player.id !== playerId) return { error: 'Not your turn' };
        room.narrativeLog.push({
            player: player.name,
            text,
            turn: room.turnNumber,
            timestamp: Date.now()
        });
        return { success: true, log: room.narrativeLog };
    }

    endTurn(roomCode, playerId) {
        const room = this.rooms.get(roomCode.toUpperCase());
        if (!room) return { error: 'Room not found' };
        const player = room.getCurrentPlayer();
        if (player.id !== playerId) return { error: 'Not your turn' };
        room.currentTurn = room.currentTurn === 'p1' ? 'p2' : 'p1';
        if (room.currentTurn === 'p1') room.turnNumber++;
        return { success: true, currentTurn: room.currentTurn, turnNumber: room.turnNumber };
    }

    declareVictory(roomCode, playerId, type) {
        const room = this.rooms.get(roomCode.toUpperCase());
        if (!room) return { error: 'Room not found' };
        const player = room.getCurrentPlayer();
        if (player.id !== playerId) return { error: 'Not your turn' };
        room.phase = 'ended';
        room.winner = playerId;
        room.narrativeLog.push({
            player: player.name,
            text: type === 'surrender' ? '宣布投降' : '宣布死亡',
            turn: room.turnNumber,
            timestamp: Date.now()
        });
        return { success: true, winner: player.name, type };
    }

    getPublicState(room) {
        if (!room) return null;
        return {
            code: room.code,
            phase: room.phase,
            turnNumber: room.turnNumber,
            currentTurn: room.currentTurn,
            currentPlayerId: room.getCurrentPlayer()?.id,
            narrativeLog: room.narrativeLog,
            winner: room.winner ? (room.player1.id === room.winner ? room.player1.name : room.player2?.name) : null,
            player1: room.player1 ? {
                id: room.player1.id,
                name: room.player1.name,
                hand: room.player1.hand,
                ready: room.player1.ready
            } : null,
            player2: room.player2 ? {
                id: room.player2.id,
                name: room.player2.name,
                hand: room.player2.hand,
                ready: room.player2.ready
            } : null
        };
    }

    getWaitingRooms() {
        return Array.from(this.rooms.values())
            .filter(r => r.phase === 'lobby' && !r.isFull())
            .map(r => ({ code: r.code, host: r.player1.name, createdAt: r.createdAt }));
    }
}

module.exports = GameManager;
```

- [ ] **Step 2: Update server.js routes**

Replace lines 88-202 in `src/server.js` with:

```javascript
// ========== ROOM ROUTES ==========

// Create a new room
app.post('/api/room/create', (req, res) => {
    const { playerName, hand } = req.body;
    if (!playerName || !hand) {
        return res.status(400).json({ error: 'playerName and hand required' });
    }
    const { room, playerId } = gameManager.createRoom(playerName, hand);
    res.json({
        roomCode: room.code,
        playerId,
        phase: room.phase,
        message: 'Room created. Share code with opponent.'
    });
});

// Join existing room
app.post('/api/room/join', (req, res) => {
    const { roomCode, playerName, hand } = req.body;
    if (!roomCode || !playerName || !hand) {
        return res.status(400).json({ error: 'roomCode, playerName, and hand required' });
    }
    const result = gameManager.joinRoom(roomCode, playerName, hand);
    if (result.error) return res.status(400).json(result);
    res.json({
        roomCode: result.room.code,
        playerId: result.playerId,
        phase: result.room.phase,
        message: 'Joined room!'
    });
});

// Get room state
app.get('/api/room/:code', (req, res) => {
    const room = gameManager.getRoom(req.params.code);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(gameManager.getPublicState(room));
});

// Submit narrative action
app.post('/api/room/:code/narrate', (req, res) => {
    const { playerId, text } = req.body;
    const result = gameManager.submitNarrative(req.params.code, playerId, text);
    if (result.error) return res.status(400).json(result);
    res.json(result);
});

// End turn
app.post('/api/room/:code/endturn', (req, res) => {
    const { playerId } = req.body;
    const result = gameManager.endTurn(req.params.code, playerId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
});

// Player declares victory (surrender/death)
app.post('/api/room/:code/victory', (req, res) => {
    const { playerId, type } = req.body;
    const result = gameManager.declareVictory(req.params.code, playerId, type);
    if (result.error) return res.status(400).json(result);
    res.json(result);
});

// List waiting rooms
app.get('/api/rooms', (req, res) => {
    res.json(gameManager.getWaitingRooms());
});
```

- [ ] **Step 3: Test backend routes**

Run: `cd "c:\Dark Game Battle System"; npm start`

In another terminal:
```powershell
# Test room creation
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/room/create" -ContentType "application/json" -Body '{"playerName":"Test","hand":{"race":"test","weapon":"test","abilities":["a1","a2","a3"],"entity":"test"}}'
```
Expected: Valid JSON with roomCode, playerId

- [ ] **Commit**

```bash
git add src/game/GameManager.js src/server.js
git commit -m "feat: replace battle logic with room-based narrative system"
```

---

## Task 2: Battle Interface - Core Layout

**Files:**
- Modify: `public/battle.html` (complete rewrite)

- [ ] **Step 1: Create full battle.html**

Replace entire content of `public/battle.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DARK GAME - Battle Arena</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Orbitron:wght@400;700&family=Rajdhani:wght@400;600;700&family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --void-black: #0a0a0f;
            --deep-void: #12121a;
            --blood-crimson: #dc143c;
            --electric-cyan: #00f5ff;
            --gold-ember: #ff8c00;
            --soul-purple: #9932cc;
            --grey-dim: #404050;
            --grey-mid: #606070;
        }
        body {
            font-family: 'Rajdhani', sans-serif;
            background: var(--void-black);
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 30px;
            background: linear-gradient(180deg, var(--deep-void), transparent);
            border-bottom: 1px solid var(--grey-dim);
        }
        .logo {
            font-family: 'Bebas Neue', sans-serif;
            font-size: 2rem;
            letter-spacing: 4px;
            background: linear-gradient(90deg, var(--blood-crimson), var(--soul-purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .lang-toggle { display: flex; border: 1px solid var(--grey-mid); border-radius: 4px; }
        .lang-btn { padding: 8px 12px; background: transparent; border: none; color: var(--grey-mid); cursor: pointer; font-family: inherit; font-size: 0.9rem; }
        .lang-btn.active { background: var(--soul-purple); color: #fff; }
        .arena { display: grid; grid-template-columns: 1fr 320px 1fr; gap: 20px; padding: 20px; max-width: 1600px; margin: 0 auto; min-height: calc(100vh - 80px); }
        .fighter-panel { background: var(--deep-void); border-radius: 12px; padding: 20px; border: 2px solid var(--grey-dim); transition: all 0.3s; display: flex; flex-direction: column; gap: 12px; }
        .fighter-panel.player1 { border-color: var(--electric-cyan); }
        .fighter-panel.player2 { border-color: var(--blood-crimson); }
        .fighter-panel.current-turn { animation: pulse-glow 2s infinite; }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(255,255,255,0.1); } 50% { box-shadow: 0 0 40px rgba(255,255,255,0.2); } }
        .fighter-name { font-family: 'Orbitron', sans-serif; font-size: 1.4rem; text-align: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; }
        .player1 .fighter-name { color: var(--electric-cyan); }
        .player2 .fighter-name { color: var(--blood-crimson); }
        .card-slot { background: rgba(0,0,0,0.4); border: 1px solid var(--grey-dim); border-radius: 8px; padding: 10px; min-height: 60px; display: flex; flex-direction: column; justify-content: center; font-family: 'Noto Sans JP', sans-serif; font-size: 0.9rem; text-align: center; }
        .card-slot.race { border-color: var(--soul-purple); }
        .card-slot.weapon { border-color: var(--gold-ember); }
        .card-slot.ability { border-color: var(--electric-cyan); }
        .card-slot.entity { border-color: var(--blood-crimson); }
        .card-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 2px; color: var(--grey-mid); margin-bottom: 4px; }
        .passive-keyword { color: var(--soul-purple); font-weight: 700; text-shadow: 0 0 8px var(--soul-purple); }
        .passives-section { display: none; background: rgba(153, 50, 204, 0.1); border: 1px dashed var(--soul-purple); border-radius: 8px; padding: 10px; }
        .passives-section.active { display: block; }
        .passive-alert { color: var(--soul-purple); font-size: 0.85rem; padding: 8px; background: rgba(153, 50, 204, 0.2); border-radius: 4px; animation: passive-pulse 1.5s infinite; }
        @keyframes passive-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        .narrative-center { display: flex; flex-direction: column; gap: 15px; }
        .turn-indicator { background: var(--deep-void); border: 2px solid var(--gold-ember); border-radius: 12px; padding: 20px; text-align: center; }
        .turn-indicator .turn-num { font-family: 'Bebas Neue', sans-serif; font-size: 3rem; color: var(--gold-ember); }
        .turn-indicator .current-player { font-size: 1.2rem; color: #fff; margin-top: 5px; }
        .environment-card { background: var(--deep-void); border: 1px solid var(--grey-dim); border-radius: 8px; padding: 15px; text-align: center; }
        .environment-card .label { font-size: 0.7rem; color: var(--grey-mid); letter-spacing: 2px; }
        .environment-card .place-name { font-family: 'Noto Sans JP', sans-serif; font-size: 1.1rem; margin-top: 5px; }
        .narrative-input-section { background: var(--deep-void); border-radius: 12px; padding: 15px; display: flex; flex-direction: column; gap: 10px; }
        .narrative-input { width: 100%; min-height: 80px; background: rgba(0,0,0,0.4); border: 1px solid var(--grey-dim); border-radius: 8px; padding: 12px; color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 1rem; resize: vertical; }
        .narrative-input:focus { outline: none; border-color: var(--electric-cyan); }
        .action-buttons { display: flex; flex-direction: column; gap: 8px; }
        .btn { padding: 12px 20px; border: none; border-radius: 6px; font-family: 'Rajdhani', sans-serif; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.3s; text-transform: uppercase; letter-spacing: 1px; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background: linear-gradient(135deg, var(--electric-cyan), #0088aa); color: #000; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(0, 245, 255, 0.3); }
        .btn-secondary { background: var(--grey-dim); color: #fff; }
        .btn-danger { background: var(--blood-crimson); color: #fff; }
        .combat-log { background: var(--deep-void); border-radius: 12px; padding: 15px; max-height: 250px; overflow-y: auto; }
        .combat-log h3 { font-family: 'Orbitron', sans-serif; font-size: 0.9rem; color: var(--grey-mid); margin-bottom: 10px; text-transform: uppercase; }
        .log-entry { padding: 8px 0; border-bottom: 1px solid var(--grey-dim); font-size: 0.9rem; }
        .log-player { font-weight: 700; }
        .log-player.p1 { color: var(--electric-cyan); }
        .log-player.p2 { color: var(--blood-crimson); }
        .log-turn { font-size: 0.7rem; color: var(--grey-mid); margin-left: 5px; }
        .victory-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; justify-content: center; align-items: center; flex-direction: column; gap: 30px; }
        .victory-overlay.active { display: flex; }
        .victory-text { font-family: 'Bebas Neue', sans-serif; font-size: 4rem; text-align: center; color: var(--gold-ember); }
        .debate-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.95); z-index: 1000; justify-content: center; align-items: center; }
        .debate-overlay.active { display: flex; }
        .debate-panel { background: var(--deep-void); border: 2px solid var(--gold-ember); border-radius: 12px; padding: 30px; max-width: 800px; width: 90%; }
        .debate-header { font-family: 'Orbitron', sans-serif; text-align: center; color: var(--gold-ember); margin-bottom: 20px; }
        .debate-sides { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .debate-side { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 15px; }
        .debate-side.attack { border-left: 3px solid var(--electric-cyan); }
        .debate-side.defend { border-left: 3px solid var(--blood-crimson); }
        .debate-chat { background: rgba(0,0,0,0.4); border-radius: 8px; padding: 15px; height: 150px; overflow-y: auto; margin-bottom: 15px; }
        .debate-input-row { display: flex; gap: 10px; }
        .debate-input-row input { flex: 1; padding: 10px; background: rgba(0,0,0,0.4); border: 1px solid var(--grey-dim); border-radius: 6px; color: #fff; font-family: inherit; }
        .resolution-buttons { display: flex; gap: 15px; justify-content: center; margin-top: 15px; }
        .btn-counts { background: #228b22; padding: 10px 30px; }
        .btn-void { background: #8b0000; padding: 10px 30px; }
        .rules-link { position: fixed; bottom: 20px; right: 20px; color: var(--grey-mid); text-decoration: none; font-size: 0.9rem; }
        .rules-link:hover { color: var(--gold-ember); }
    </style>
</head>
<body>
    <header class="header">
        <div class="logo">DARK GAME</div>
        <div class="header-right">
            <div class="lang-toggle">
                <button class="lang-btn active" data-lang="zh">中文</button>
                <button class="lang-btn" data-lang="en">EN</button>
            </div>
        </div>
    </header>
    
    <main class="arena">
        <div class="fighter-panel player1" id="p1-panel">
            <div class="fighter-name" id="p1-name">Player 1</div>
            <div class="card-slot race"><div class="card-label" data-i18n="race">種族</div><div id="p1-race">-</div></div>
            <div class="card-slot weapon"><div class="card-label" data-i18n="weapon">武器</div><div id="p1-weapon">-</div></div>
            <div class="card-slot ability"><div class="card-label" data-i18n="ability1">能力 1</div><div id="p1-ability-1">-</div></div>
            <div class="card-slot ability"><div class="card-label" data-i18n="ability2">能力 2</div><div id="p1-ability-2">-</div></div>
            <div class="card-slot ability"><div class="card-label" data-i18n="ability3">能力 3</div><div id="p1-ability-3">-</div></div>
            <div class="card-slot entity"><div class="card-label" data-i18n="entity">召喚物</div><div id="p1-entity">-</div></div>
            <div class="passives-section" id="p1-passives"><div class="passive-alert" data-i18n="passive-hint">被動提示</div></div>
        </div>
        
        <div class="narrative-center">
            <div class="turn-indicator">
                <div class="turn-num">TURN <span id="turn-number">1</span></div>
                <div class="current-player" id="current-player-text">等待中...</div>
            </div>
            <div class="environment-card">
                <div class="label" data-i18n="environment">環境</div>
                <div class="place-name" id="environment-place">-</div>
            </div>
            <div class="narrative-input-section">
                <textarea class="narrative-input" id="narrative-input" placeholder="描述你的攻擊... / Describe your attack..."></textarea>
                <div class="action-buttons">
                    <button class="btn btn-primary" id="btn-submit" data-i18n="submit">送出</button>
                    <button class="btn btn-secondary" id="btn-endturn" data-i18n="end-turn">結束回合</button>
                    <button class="btn btn-secondary" id="btn-debate" data-i18n="debate">辯論</button>
                    <button class="btn btn-danger" id="btn-surrender" data-i18n="surrender">投降</button>
                    <button class="btn btn-danger" id="btn-death" data-i18n="death">宣布死亡</button>
                </div>
            </div>
            <div class="combat-log">
                <h3 data-i18n="combat-log">戰鬥記錄</h3>
                <div id="combat-log-content"></div>
            </div>
        </div>
        
        <div class="fighter-panel player2" id="p2-panel">
            <div class="fighter-name" id="p2-name">Player 2</div>
            <div class="card-slot race"><div class="card-label" data-i18n="race">種族</div><div id="p2-race">-</div></div>
            <div class="card-slot weapon"><div class="card-label" data-i18n="weapon">武器</div><div id="p2-weapon">-</div></div>
            <div class="card-slot ability"><div class="card-label" data-i18n="ability1">能力 1</div><div id="p2-ability-1">-</div></div>
            <div class="card-slot ability"><div class="card-label" data-i18n="ability2">能力 2</div><div id="p2-ability-2">-</div></div>
            <div class="card-slot ability"><div class="card-label" data-i18n="ability3">能力 3</div><div id="p2-ability-3">-</div></div>
            <div class="card-slot entity"><div class="card-label" data-i18n="entity">召喚物</div><div id="p2-entity">-</div></div>
            <div class="passives-section" id="p2-passives"><div class="passive-alert" data-i18n="passive-hint">被動提示</div></div>
        </div>
    </main>
    
    <div class="victory-overlay" id="victory-overlay">
        <div class="victory-text" id="victory-text">勝利!</div>
        <button class="btn btn-primary" onclick="location.href='index.html'" data-i18n="return-lobby">返回大廳</button>
    </div>
    
    <div class="debate-overlay" id="debate-overlay">
        <div class="debate-panel">
            <h2 class="debate-header" data-i18n="debate-title">辯論模式</h2>
            <div class="debate-sides">
                <div class="debate-side attack"><div class="card-label" data-i18n="attacker">攻擊方</div><div id="debate-attack-text"></div></div>
                <div class="debate-side defend"><div class="card-label" data-i18n="defender">防守方</div><div id="debate-defend-text"></div></div>
            </div>
            <div class="debate-chat" id="debate-chat"></div>
            <div class="debate-input-row">
                <input type="text" id="debate-input" placeholder="輸入論點...">
                <button class="btn btn-secondary" id="btn-debate-send">送出</button>
            </div>
            <div class="resolution-buttons">
                <button class="btn btn-counts" id="btn-counts" data-i18n="counts">算我贏</button>
                <button class="btn btn-void" id="btn-void" data-i18n="void">不算</button>
                <button class="btn btn-secondary" id="btn-debate-close" data-i18n="cancel">取消</button>
            </div>
        </div>
    </div>
    
    <a href="rules.html" class="rules-link" data-i18n="rules">規則 / Rules</a>
    
    <script>
        const i18n = {
            zh: { race:'種族', weapon:'武器', ability1:'能力 1', ability2:'能力 2', ability3:'能力 3', entity:'召喚物', submit:'送出', 'end-turn':'結束回合', debate:'辯論', surrender:'投降', death:'宣布死亡', 'combat-log':'戰鬥記錄', 'victory-title':'勝利!', 'return-lobby':'返回大廳', 'debate-title':'辯論模式', attacker:'攻擊方', defender:'防守方', send:'送出', counts:'算我贏', void:'不算', cancel:'取消', rules:'規則', 'passive-hint':'被動觸發提示', 'your-turn':'你的回合', waiting:'等待中...', environment:'環境' },
            en: { race:'Race', weapon:'Weapon', ability1:'Ability 1', ability2:'Ability 2', ability3:'Ability 3', entity:'Entity', submit:'SUBMIT', 'end-turn':'END TURN', debate:'DEBATE', surrender:'SURRENDER', death:'DECLARE DEATH', 'combat-log':'Combat Log', 'victory-title':'VICTORY!', 'return-lobby':'RETURN TO LOBBY', 'debate-title':'DEBATE MODE', attacker:'ATTACKER', defender:'DEFENDER', send:'SEND', counts:'COUNTS', void:'VOID', cancel:'CANCEL', rules:'Rules', 'passive-hint':'Passive Hint', 'your-turn':'Your Turn', waiting:'Waiting...', environment:'ENVIRONMENT' }
        };
        
        let currentLang = 'zh';
        let playerId = null;
        let roomCode = null;
        let currentTurn = null;
        
        const passivePatterns = ['舔血', '吸收', '再生', '反彈', '閃避', '盾', '護體', '不死'];
        
        function highlightPassives(text) {
            let result = text || '';
            passivePatterns.forEach(p => {
                if (result.includes(p)) {
                    result = result.replace(p, `<span class="passive-keyword">${p}</span>`);
                }
            });
            return result;
        }
        
        function detectPassive(cardText) {
            return passivePatterns.find(p => cardText && cardText.includes(p));
        }
        
        function updateLanguage(lang) {
            currentLang = lang;
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (i18n[lang][key]) el.textContent = i18n[lang][key];
            });
            document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
            updateTurnIndicator();
        }
        
        function updateTurnIndicator() {
            document.getElementById('turn-number').textContent = currentTurn?.turnNumber || 1;
            const text = currentTurn?.playerId === playerId ? i18n[currentLang]['your-turn'] : i18n[currentLang]['waiting'];
            document.getElementById('current-player-text').textContent = text;
        }
        
        function renderLog(log) {
            const content = document.getElementById('combat-log-content');
            content.innerHTML = (log || []).map(e => `<div class="log-entry"><span class="log-player p1">${e.player}:</span> ${e.text} <span class="log-turn">T${e.turn}</span></div>`).join('');
            content.scrollTop = content.scrollHeight;
        }
        
        function renderState(state) {
            currentTurn = { turnNumber: state.turnNumber, playerId: state.currentPlayerId };
            
            if (state.player1) {
                const h = state.player1.hand;
                document.getElementById('p1-name').textContent = state.player1.name;
                document.getElementById('p1-race').innerHTML = highlightPassives(h.race);
                document.getElementById('p1-weapon').innerHTML = highlightPassives(h.weapon);
                document.getElementById('p1-ability-1').innerHTML = highlightPassives(h.abilities[0]);
                document.getElementById('p1-ability-2').innerHTML = highlightPassives(h.abilities[1]);
                document.getElementById('p1-ability-3').innerHTML = highlightPassives(h.abilities[2]);
                document.getElementById('p1-entity').innerHTML = highlightPassives(h.entity);
                document.getElementById('p1-panel').dataset.playerId = state.player1.id;
            }
            
            if (state.player2) {
                const h = state.player2.hand;
                document.getElementById('p2-name').textContent = state.player2.name;
                document.getElementById('p2-race').innerHTML = highlightPassives(h.race);
                document.getElementById('p2-weapon').innerHTML = highlightPassives(h.weapon);
                document.getElementById('p2-ability-1').innerHTML = highlightPassives(h.abilities[0]);
                document.getElementById('p2-ability-2').innerHTML = highlightPassives(h.abilities[1]);
                document.getElementById('p2-ability-3').innerHTML = highlightPassives(h.abilities[2]);
                document.getElementById('p2-entity').innerHTML = highlightPassives(h.entity);
                document.getElementById('p2-panel').dataset.playerId = state.player2.id;
                
                // Check passives
                const p1Cards = [...Object.values(state.player1.hand).flat(), ...Object.values(state.player2.hand).flat()].filter(Boolean);
                ['p1', 'p2'].forEach(p => {
                    const hasPassive = Object.values(p === 'p1' ? state.player1.hand : state.player2.hand).some(c => detectPassive(c));
                    document.getElementById(`${p}-passives`).classList.toggle('active', hasPassive);
                });
            }
            
            if (state.environment) document.getElementById('environment-place').textContent = state.environment;
            renderLog(state.narrativeLog);
            updateTurnIndicator();
            
            if (state.phase === 'ended' && state.winner) {
                const winnerName = state.winner === state.player1.id ? state.player1.name : state.player2.name;
                document.getElementById('victory-text').textContent = `${winnerName} ${i18n[currentLang]['victory-title']}`;
                document.getElementById('victory-overlay').classList.add('active');
            }
        }
        
        async function submitNarrative() {
            const text = document.getElementById('narrative-input').value.trim();
            if (!text) return;
            const res = await fetch(`/api/room/${roomCode}/narrate`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ playerId, text }) });
            const result = await res.json();
            if (result.success) { document.getElementById('narrative-input').value = ''; renderLog(result.log); }
        }
        
        async function endTurn() {
            const res = await fetch(`/api/room/${roomCode}/endturn`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ playerId }) });
            const result = await res.json();
            if (result.success) fetchState();
        }
        
        async function declareVictory(type) {
            if (!confirm(type === 'surrender' ? '投降?' : '確認死亡?')) return;
            const res = await fetch(`/api/room/${roomCode}/victory`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ playerId, type }) });
            const result = await res.json();
            if (result.success) { document.getElementById('victory-text').textContent = `${result.winner} ${i18n[currentLang]['victory-title']}`; document.getElementById('victory-overlay').classList.add('active'); }
        }
        
        async function fetchState() {
            const res = await fetch(`/api/room/${roomCode}`);
            const state = await res.json();
            renderState(state);
        }
        
        function openDebate() {
            const lastEntry = document.querySelector('.log-entry:last-child');
            if (lastEntry) {
                document.getElementById('debate-attack-text').textContent = lastEntry.textContent;
                document.getElementById('debate-overlay').classList.add('active');
            }
        }
        
        // Events
        document.querySelectorAll('.lang-btn').forEach(btn => btn.addEventListener('click', () => updateLanguage(btn.dataset.lang)));
        document.getElementById('btn-submit').addEventListener('click', submitNarrative);
        document.getElementById('btn-endturn').addEventListener('click', endTurn);
        document.getElementById('btn-debate').addEventListener('click', openDebate);
        document.getElementById('btn-surrender').addEventListener('click', () => declareVictory('surrender'));
        document.getElementById('btn-death').addEventListener('click', () => declareVictory('death'));
        document.getElementById('btn-debate-close').addEventListener('click', () => document.getElementById('debate-overlay').classList.remove('active'));
        document.getElementById('btn-counts').addEventListener('click', () => { document.getElementById('debate-overlay').classList.remove('active'); alert('攻擊方獲勝 / Attacker wins'); });
        document.getElementById('btn-void').addEventListener('click', () => { document.getElementById('debate-overlay').classList.remove('active'); alert('不算 / Voided'); });
        
        function init() {
            const params = new URLSearchParams(window.location.search);
            roomCode = params.get('room');
            playerId = params.get('player');
            if (!roomCode || !playerId) { alert('Invalid room'); location.href = 'index.html'; return; }
            updateLanguage(currentLang);
            fetchState();
            setInterval(fetchState, 3000);
        }
        init();
    </script>
</body>
</html>
```

- [ ] **Step 2: Test battle.html loads**

Visit: `http://localhost:3000/battle.html?room=TEST01&player=abc123`
Expected: Page loads, no JS errors, UI visible

- [ ] **Commit**

```bash
git add public/battle.html
git commit -m "feat: complete battle arena with turn management"
```

---

## Task 3: Lobby Interface - Room Create/Join

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add room UI to index.html**

Add before `</body>`:

```html
    <!-- Room/Join Overlays -->
    <div class="room-overlay" id="room-overlay">
        <div class="room-header">
            <h2>DARK GAME - 房間</h2>
            <span class="room-code-display" id="room-code-display">------</span>
        </div>
        <div class="room-status">
            <p class="status-text" id="room-status-text">等待對手...</p>
            <button class="btn btn-secondary" onclick="copyRoomCode()">複製房間碼</button>
            <button class="btn btn-danger" onclick="leaveRoom()">離開</button>
        </div>
        <div class="room-hands">
            <div class="room-hand"><h3 id="host-name">Player 1</h3><div class="hand-display" id="host-hand"></div></div>
            <div class="vs-divider">VS</div>
            <div class="room-hand"><h3 id="guest-name" style="color: var(--grey-mid)">等待中...</h3><div class="hand-display" id="guest-hand"></div></div>
        </div>
        <button class="btn btn-primary btn-start" id="btn-start-battle" disabled onclick="startBattle()">開始戰鬥</button>
    </div>
    
    <div class="join-overlay" id="join-overlay">
        <div class="join-box">
            <h2>加入房間</h2>
            <input type="text" id="join-code-input" maxlength="6" placeholder="房間碼" class="code-input">
            <div class="join-buttons">
                <button class="btn btn-secondary" onclick="document.getElementById('join-overlay').classList.remove('active')">取消</button>
                <button class="btn btn-primary" onclick="joinRoom()">加入</button>
            </div>
        </div>
    </div>
```

- [ ] **Step 2: Add room CSS to index.html**

Add to `<style>`:

```css
    .room-overlay, .join-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(10, 10, 15, 0.98); z-index: 100; padding: 40px; flex-direction: column; align-items: center; }
    .room-overlay.active, .join-overlay.active { display: flex; }
    .room-header { text-align: center; margin-bottom: 30px; }
    .room-header h2 { font-family: 'Bebas Neue', sans-serif; font-size: 2.5rem; letter-spacing: 4px; margin-bottom: 15px; }
    .room-code-display { font-family: 'Orbitron', sans-serif; font-size: 3rem; color: var(--gold-ember); letter-spacing: 8px; display: block; }
    .room-status { display: flex; flex-direction: column; align-items: center; gap: 15px; margin-bottom: 30px; }
    .status-text { color: var(--grey-mid); font-size: 1.2rem; }
    .room-hands { display: flex; gap: 60px; justify-content: center; margin-bottom: 40px; }
    .room-hand { text-align: center; }
    .room-hand h3 { font-family: 'Orbitron', sans-serif; margin-bottom: 15px; }
    .room-hand:first-child h3 { color: var(--electric-cyan); }
    .room-hand:last-child h3 { color: var(--blood-crimson); }
    .hand-display { background: var(--deep-void); border: 1px solid var(--grey-dim); border-radius: 12px; padding: 20px; min-width: 250px; min-height: 200px; }
    .vs-divider { font-family: 'Bebas Neue', sans-serif; font-size: 3rem; color: var(--gold-ember); align-self: center; }
    .btn-start { font-size: 1.2rem; padding: 15px 40px; }
    .join-box { background: var(--deep-void); border: 2px solid var(--grey-dim); border-radius: 12px; padding: 40px; text-align: center; }
    .join-box h2 { font-family: 'Bebas Neue', sans-serif; margin-bottom: 30px; }
    .code-input { font-family: 'Orbitron', sans-serif; font-size: 2rem; text-align: center; letter-spacing: 8px; padding: 15px; background: rgba(0,0,0,0.4); border: 2px solid var(--grey-dim); border-radius: 8px; color: #fff; width: 250px; text-transform: uppercase; }
    .join-buttons { display: flex; gap: 15px; justify-content: center; margin-top: 30px; }
    .hand-display .card { margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; font-family: 'Noto Sans JP', sans-serif; font-size: 0.9rem; }
    .hand-display .card.race { border-left: 3px solid var(--soul-purple); }
    .hand-display .card.weapon { border-left: 3px solid var(--gold-ember); }
    .hand-display .card.ability { border-left: 3px solid var(--electric-cyan); }
    .hand-display .card.entity { border-left: 3px solid var(--blood-crimson); }
```

- [ ] **Step 3: Add room JS to index.html**

Add before `</script>`:

```javascript
    let currentRoomCode = null;
    let currentPlayerId = null;
    let currentHand = null;
    
    function showHandPreview() {
        fetch('/api/draw/hand')
            .then(r => r.json())
            .then(hand => {
                currentHand = hand;
                const preview = document.getElementById('card-preview');
                if (preview) {
                    preview.innerHTML = `
                        <div class="card race">${hand.race}</div>
                        <div class="card weapon">${hand.weapon}</div>
                        <div class="card ability">${hand.abilities[0]}</div>
                        <div class="card ability">${hand.abilities[1]}</div>
                        <div class="card ability">${hand.abilities[2]}</div>
                        <div class="card entity">${hand.entity}</div>
                    `;
                }
                document.getElementById('draw-text').textContent = '牌已抽好! 準備戰鬥?';
                document.getElementById('btn-create-room').disabled = false;
                document.getElementById('btn-show-join').style.display = 'inline-block';
            });
    }
    
    async function createRoom() {
        if (!currentHand) { alert('先抽牌!'); return; }
        const playerName = document.getElementById('player-name').value || 'Player';
        const res = await fetch('/api/room/create', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ playerName, hand: currentHand }) });
        const result = await res.json();
        currentRoomCode = result.roomCode;
        currentPlayerId = result.playerId;
        document.getElementById('room-code-display').textContent = currentRoomCode;
        document.getElementById('host-name').textContent = playerName;
        document.getElementById('host-hand').innerHTML = renderHandHtml(currentHand);
        document.getElementById('room-overlay').classList.add('active');
        pollRoom();
    }
    
    async function joinRoom() {
        const code = document.getElementById('join-code-input').value.trim().toUpperCase();
        const playerName = document.getElementById('player-name').value || 'Player';
        if (!currentHand || !code) { alert('請抽牌並輸入房間碼!'); return; }
        const res = await fetch('/api/room/join', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ roomCode: code, playerName, hand: currentHand }) });
        const result = await res.json();
        if (result.error) { alert(result.error); return; }
        currentRoomCode = result.roomCode;
        currentPlayerId = result.playerId;
        document.getElementById('room-code-display').textContent = currentRoomCode;
        document.getElementById('room-overlay').classList.add('active');
        document.getElementById('join-overlay').classList.remove('active');
        pollRoom();
    }
    
    function renderHandHtml(hand) {
        return `<div class="card race">${hand.race}</div><div class="card weapon">${hand.weapon}</div><div class="card ability">${hand.abilities[0]}</div><div class="card ability">${hand.abilities[1]}</div><div class="card ability">${hand.abilities[2]}</div><div class="card entity">${hand.entity}</div>`;
    }
    
    function copyRoomCode() { navigator.clipboard.writeText(currentRoomCode); alert('已複製!'); }
    function leaveRoom() { if (confirm('離開房間?')) location.reload(); }
    function startBattle() { window.location.href = `battle.html?room=${currentRoomCode}&player=${currentPlayerId}`; }
    
    let pollInterval = null;
    function pollRoom() {
        pollInterval = setInterval(async () => {
            const res = await fetch(`/api/room/${currentRoomCode}`);
            const state = await res.json();
            if (state.player2) {
                document.getElementById('guest-name').textContent = state.player2.name;
                document.getElementById('guest-name').style.color = 'var(--blood-crimson)';
                document.getElementById('guest-hand').innerHTML = renderHandHtml(state.player2.hand);
                document.getElementById('btn-start-battle').disabled = false;
            }
        }, 2000);
    }
```

- [ ] **Step 4: Add buttons to index.html**

Find the draw button div and add Create/Join buttons:

```html
    <button class="btn btn-secondary" onclick="window.location.href='battle.html'">直接進入戰鬥</button>
    <button class="btn btn-primary" id="btn-create-room" disabled onclick="createRoom()">創建房間</button>
    <button class="btn btn-secondary" id="btn-show-join" style="display:none" onclick="document.getElementById('join-overlay').classList.add('active')">加入房間</button>
```

- [ ] **Step 5: Test create/join flow**

1. Start server, visit index.html
2. Enter name, click Draw, click Create Room
3. Copy room code, open second tab
4. Repeat, enter code, click Join Room
5. Both should see each other's hands, Start Battle button enabled

- [ ] **Commit**

```bash
git add public/index.html
git commit -m "feat: add room create/join to lobby"
```

---

## Task 4: Rules Page

**Files:**
- Create: `public/rules.html`

- [ ] **Step 1: Create rules.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DARK GAME - Rules</title>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Orbitron:wght@400;700&family=Rajdhani:wght@400;600;700&family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root { --void-black: #0a0a0f; --deep-void: #12121a; --blood-crimson: #dc143c; --electric-cyan: #00f5ff; --gold-ember: #ff8c00; --soul-purple: #9932cc; --grey-dim: #404050; --grey-mid: #606070; }
        body { font-family: 'Rajdhani', sans-serif; background: var(--void-black); color: #fff; line-height: 1.6; }
        .header { display: flex; justify-content: space-between; align-items: center; padding: 15px 30px; background: var(--deep-void); border-bottom: 1px solid var(--grey-dim); }
        .logo { font-family: 'Bebas Neue', sans-serif; font-size: 2rem; letter-spacing: 4px; background: linear-gradient(90deg, var(--blood-crimson), var(--soul-purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .back-link { color: var(--grey-mid); text-decoration: none; font-size: 1rem; }
        .back-link:hover { color: var(--gold-ember); }
        .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
        h1 { font-family: 'Bebas Neue', sans-serif; font-size: 3rem; text-align: center; margin-bottom: 40px; letter-spacing: 4px; }
        h2 { font-family: 'Orbitron', sans-serif; font-size: 1.5rem; color: var(--electric-cyan); margin: 30px 0 15px; border-bottom: 1px solid var(--grey-dim); padding-bottom: 10px; }
        h3 { color: var(--gold-ember); margin: 20px 0 10px; }
        p { margin: 10px 0; color: #ccc; }
        ul { margin: 10px 0 20px 20px; }
        li { margin: 8px 0; color: #ccc; }
        .card-type { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 0.85rem; margin: 2px; }
        .card-race { background: rgba(153, 50, 204, 0.3); border: 1px solid var(--soul-purple); }
        .card-weapon { background: rgba(255, 140, 0, 0.3); border: 1px solid var(--gold-ember); }
        .card-ability { background: rgba(0, 245, 255, 0.3); border: 1px solid var(--electric-cyan); }
        .card-entity { background: rgba(220, 20, 60, 0.3); border: 1px solid var(--blood-crimson); }
        .highlight { color: var(--gold-ember); font-weight: 600; }
        .note { background: rgba(0, 0, 0, 0.3); border-left: 3px solid var(--soul-purple); padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    </style>
</head>
<body>
    <header class="header">
        <div class="logo">DARK GAME</div>
        <a href="index.html" class="back-link">← 返回 / Back</a>
    </header>
    
    <div class="container">
        <h1>DARK GAME 規則 / RULES</h1>
        
        <h2>遊戲介紹 / Introduction</h2>
        <p>DARK GAME 是一個<span class="highlight">純想像力的卡牌對戰系統</span>。不是比較誰的牌更強，而是用你的創意和描述來贏得辯論。</p>
        <p>DARK GAME is a <span class="highlight">pure imagination-based card battle</span> system. It's not about whose cards are stronger—it's about using your creativity and narration to win debates.</p>
        
        <div class="note">
            <strong>核心原則 / Core Principle:</strong><br>
            沒有數值計算、沒有傷害公式、沒有自動判定。<br>
            No damage calculation, no formulas, no automatic resolution.
        </div>
        
        <h2>卡牌類型 / Card Types</h2>
        <p>Each player draws 6 cards:</p>
        <ul>
            <li><span class="card-type card-race">種族 / Race</span> - Your character's origin (e.g., 賽亞人, 魔法師)</li>
            <li><span class="card-type card-weapon">武器 / Weapon</span> - Your equipment (e.g., 妖刀, 鎖鏈)</li>
            <li><span class="card-type card-ability">能力 / Ability</span> ×3 - Your techniques (e.g., 黑閃, 時間暫停)</li>
            <li><span class="card-type card-entity">召喚物 / Entity</span> - Your companion (e.g., 九尾, 烏爾媞婁)</li>
        </ul>
        
        <h2>戰鬥流程 / Battle Flow</h2>
        <h3>1. 回合制 / Turn-based</h3>
        <p>玩家輪流描述自己的攻擊。輪到你時，你的面板會發光提示。</p>
        <p>Players take turns describing attacks. When it's your turn, your panel glows.</p>
        
        <h3>2. 描述攻擊 / Describe Attack</h3>
        <p>用文字描述你的攻擊！可以提到你的卡牌來加成描述，但並非必須。</p>
        <p>Describe your attack in text! You can reference your cards to enhance descriptions, but it's not required.</p>
        
        <h3>3. 結束回合 / End Turn</h3>
        <p>說完攻擊後，點擊"結束回合"讓對手行動。</p>
        <p>After your attack, click "End Turn" to let your opponent act.</p>
        
        <h2>辯論系統 / Debate System</h2>
        <p>如果雙方對某個攻擊有爭議：</p>
        <ol>
            <li>進攻方開始敘述攻擊</li>
            <li>防守方可以點擊"辯論"來挑戰</li>
            <li>雙方各自論述</li>
            <li>由<strong>進攻方</strong>決定結果：
                <ul>
                    <li><span class="highlight">算我贏 (Counts)</span> - 攻擊成功</li>
                    <li><span class="highlight">不算 (Void)</span> - 攻擊無效</li>
                </ul>
            </li>
        </ol>
        
        <h2>被動效果 / Passive Effects</h2>
        <p>某些卡牌有被動關鍵字（如: 舔血、吸收、再生）。當觸發條件滿足時，系統會提示你描述被動效果。</p>
        <p>Some cards have passive keywords. When triggered, the system prompts you to describe the passive effect.</p>
        
        <h2>勝利條件 / Victory Conditions</h2>
        <ul>
            <li><span class="highlight">投降 / Surrender</span> - 點擊投降按鈕認輸</li>
            <li><span class="highlight">死亡 / Death</span> - 在敘述中宣佈自己的角色死亡</li>
            <li><span class="highlight">自爆 / Self-Sacrifice</span> - 敘述自爆攻擊</li>
        </ul>
        
        <h2>小技巧 / Tips</h2>
        <ul>
            <li>不要只說"我攻擊"，要描述動作、氣氛、角色的心態</li>
            <li>Don't just say "I attack"—describe the action, atmosphere, character's mindset</li>
            <li>利用卡牌名稱來啟發創意，但不要被限制</li>
            <li>Use card names to inspire creativity, but don't be limited by them</li>
            <li>辯論時保持尊重，贏了要優雅，輸了要大方</li>
            <li>Stay respectful during debates. Win with grace, lose with dignity</li>
        </ul>
        
        <h2>享受想像力的戰鬥吧！</h2>
        <p>Enjoy the battle of imagination!</p>
    </div>
</body>
</html>
```

- [ ] **Step 2: Test rules page**

Visit: `http://localhost:3000/rules.html`
Expected: Page loads, all sections visible

- [ ] **Commit**

```bash
git add public/rules.html
git commit -m "feat: add rules page"
```

---

## Task 5: Environment Card in Room

**Files:**
- Modify: `src/server.js`

- [ ] **Step 1: Add environment draw to room creation/join**

Update `/api/room/create` and `/api/room/join` routes to include environment:
```javascript
const cardPools = require('./data/pools');

app.post('/api/room/create', (req, res) => {
    const { playerName, hand } = req.body;
    const environment = cardPools.PlacePool[Math.floor(Math.random() * cardPools.PlacePool.length)];
    const { room, playerId } = gameManager.createRoom(playerName, hand);
    room.environment = environment;
    // ... rest
});
```

- [ ] **Step 2: Include environment in public state**

Update `getPublicState()` in GameManager to include environment.

- [ ]
# DARK GAME — Real-Time Multiplayer Design

**Date:** 2026-01-23
**Status:** Draft
**Scope:** Full multiplayer implementation (WebSocket sync, real-time battle narration, lobby flow)

---

## Overview

Replace the current HTTP-polling multiplayer with real-time WebSocket connections using **PartyKit** as the real-time layer on top of **Vercel** for REST APIs. The battle is entirely chat-based (imagination/narration), so the combat log IS the real-time channel. No separate chat feature needed — the narration feed serves both combat and debate functions.

**Stack:**
- **Vercel** — REST API (room create/join, card draw)
- **PartyKit** — WebSocket server (all real-time operations: narration, turn sync, debate, victory)
- **Frontend** — WebSocket client replacing 3-second polling

---

## File Structure

```
src/
├── server.ts                    ← Vercel entry point (vercel.json maps here)
├── api/
│   ├── room/create.ts           ← POST: create room + draw hand
│   ├── room/join.ts             ← POST: join existing room
│   └── cards/hand.ts            ← GET: draw a card hand
├── party/
│   └── index.ts                 ← PartyKit WebSocket handler (1 party room = 1 game room)
│
public/
├── index.html                   ← Lobby (updated: real-time room list, start button, kick button)
└── battle.html                   ← Battle arena (updated: WebSocket connection + status)

vercel.json
partykit.json
```

---

## Architecture

```
Browser (Player A) ──┐
                     ├──► Vercel REST API ── room/create, room/join, cards/hand
Browser (Player B) ──┘
                           │
                           │ HTTP responses only
                           │
Browser ───────────────────┼─────────────────── Browser
      └──► PartyKit ───────┘
         (1 WebSocket room per game session = 1 party room)
         - Real-time state push (full RoomState on every action)
         - Turn switching, victory declaration

Flow:
1. Player creates room → POST /api/room/create → Vercel returns { roomCode, playerId }
2. Player connects: wss://[app].partykit.dev/room/{roomCode}?playerId={playerId}
3. Player 2 joins via room code → POST /api/room/join → Vercel returns same data
4. Player 2 connects to same party room
5. On connect, server pushes full RoomState to that client
6. Host presses "Start Battle" → PartyKit broadcasts { type: "battleStart" } → both clients
7. Battle begins (phase: 'battle')
```

---

## Room Lifecycle

```
Phase: lobby     — Host created room, waiting for Player 2. Host can disconnect (room destroyed).
Phase: ready     — Player 2 joined. Host sees "Start Battle" button. Host can kick Player 2 (room returns to lobby).
Phase: battle    — Battle started. Both players can narrate, end turn, open debate, declare victory.
Phase: debate    — Overlay mode within battle. Attacker resolves verdict (counts/void).
Phase: ended     — Battle over. Winner declared. Room destroyed after both players disconnect.
```

### Max players: 2. Room join returns `{ error: "ROOM_FULL" }` if full.

---

## Data Model

### RoomState (PartyKit in-memory)

```typescript
interface RoomState {
  code: string;
  phase: 'lobby' | 'ready' | 'battle' | 'debate' | 'ended';
  players: [
    { id: string; name: string; hand: Hand },
    { id: string; name: string; hand: Hand } | null
  ];
  currentPlayerId: string | null;      // whose turn (only set in 'battle' phase)
  turnNumber: number;                   // increments after both players narrate
  narrativeLog: NarrativeEntry[];        // full combat history
  debateActive: boolean;
  debateEntries: DebateEntry[];         // current debate messages
  attackNarration: string | null;       // the narration being debated
  attackPlayerId: string | null;         // player who performed the contested attack
  winner: string | null;                 // player name on victory
  hostId: string;                        // host playerId (for start/kick authorization)
}

interface NarrativeEntry {
  playerId: string;
  playerName: string;
  text: string;
  turn: number;
  timestamp: number;
}

interface DebateEntry {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}
```

### Hand structure

```typescript
interface Hand {
  race: string;
  weapon: string;
  abilities: string[3];
  entity: string;
}
```

---

## API Design (Vercel REST)

### POST /api/room/create

Create room, draw hand, return credentials.

Request:
```json
{ "playerName": "string", "lang": "en|zh" }
```

Response (200):
```json
{ "roomCode": "string", "playerId": "string", "hand": Hand, "phase": "lobby" }
```

Response (400): `{ "error": "playerName required" }`

---

### POST /api/room/join

Join existing room, draw hand.

Request:
```json
{ "roomCode": "string", "playerName": "string", "lang": "en|zh" }
```

Response (200):
```json
{ "roomCode": "string", "playerId": "string", "hand": Hand, "phase": "ready" }
```

Response (400):
```json
{ "error": "Room not found" }
{ "error": "Room is full", "code": "ROOM_FULL" }
```

Frontend shows notification: "This room is full and no longer joinable."

---

### GET /api/cards/hand

Draw a single card hand (used during create/join).

Query: `?lang=en|zh`

Response (200): `{ "hand": Hand, "lang": "en|zh" }`

---

## WebSocket Protocol (PartyKit)

### PartyKit Room = Game Room

Each party room is identified by `roomCode`. PartyKit handles:
- Single persistent WebSocket connection per client per room
- Automatic cleanup when last client disconnects
- In-memory state per room (no DB)

### Client → Server Messages

```typescript
{ type: "startBattle" }
  // Only host can send. Validates hostId. Transitions phase: 'ready' → 'battle'.
  // Broadcasts { type: "battleStart" } to all clients.

{ type: "kickPlayer" }
  // Only host can send. Disconnects Player 2. Resets phase → 'lobby'.

{ type: "narrate", text: "string" }
  // Player submits narration (their attack description).
  // Only valid if it is their turn (currentPlayerId === senderId).
  // Appends to narrativeLog. Broadcasts full updated RoomState.

{ type: "endTurn" }
  // Only valid if it's their turn.
  // Switches currentPlayerId to opponent. Increments turnNumber if returning to P1.
  // Broadcasts full updated RoomState.

{ type: "openDebate" }
  // Defender challenges the last narration from their opponent.
  // Sets debateActive: true, stores attackNarration + attackPlayerId.
  // Broadcasts updated RoomState (debate overlay shown on both clients).

{ type: "debateMessage", text: "string" }
  // Player sends a message in the debate chat.
  // Appends to debateEntries. Broadcasts to both clients.

{ type: "resolveDebate", verdict: "counts" | "void" }
  // Only attacker (attackPlayerId) can resolve.
  // Sets debateActive: false, clears debateEntries + attackNarration + attackPlayerId.
  // Broadcasts updated RoomState. Returns to normal battle narration.

{ type: "declareVictory", method: "surrender" | "death" | "selfSacrifice" }
  // Player declares their own defeat. Sets phase: 'ended', winner = opponent name.
  // Broadcasts { type: "victory", winner: "string" }.

{ type: "ping" }
  // Client heartbeat. Server responds { type: "pong" }.
```

### Server → Client Messages

```typescript
{ type: "state", payload: RoomState }
  // Pushed on every significant action and on initial connect.
  // This is the single source of truth for client-side rendering.

{ type: "error", code: "string", message: "string" }
  // Validation failures, unauthorized actions.

{ type: "battleStart" }
  // Emitted when host starts the battle. Triggers "Battle starting..." animation.

{ type: "playerKicked" }
  // Sent to kicked player only. Triggers notification + return to lobby.
```

---

## Frontend Changes

### Lobby (index.html)

1. **WebSocket for room wait list** — Connect to PartyKit `lobby` party to see real-time waiting rooms (or keep polling, it's fine at lobby scale — Vercel free tier is not a concern here).
2. **"Start Battle" button** — Enabled when Player 2 joins. Sends `startBattle` message.
3. **"Kick Player" button** — Visible to host only. Sends `kickPlayer` message → Player 2 sees disconnect + notification.
4. **Join rejection notification** — When `/api/room/join` returns `ROOM_FULL`, show: "This room is full and no longer joinable." (No redirect, just message).

### Battle Arena (battle.html)

1. **WebSocket connection** — Connect on page load: `party.connect(roomCode, { playerId })`.
2. **Remove polling** — Delete `setInterval(fetchState, 3000)`.
3. **On `state` message** — Replace entire render logic: `state` payload replaces all previous state.
4. **WebSocket status indicator** — Show in header: "Connected" (green) / "Reconnecting..." (yellow) / "Disconnected" (red, with refresh prompt).
5. **Auto-reconnect** — On disconnect, retry up to 5 times with exponential backoff (1s, 2s, 4s, 8s, 16s). After 5 failures, show "Connection lost. Refresh to rejoin." button.
6. **Debate UI** — Already exists in `debate-overlay`. Replace the debate chat's `addDebateMessage()` with PartyKit `debateMessage` sending. `resolveDebate` triggers verdict.
7. **Victory** — On `{ type: "victory" }`, show victory overlay.

---

## Error Handling

| Scenario | Response |
|---|---|
| WebSocket disconnects | Auto-reconnect (5 attempts, exp backoff). After max, show "Connection lost. Refresh to rejoin." |
| Invalid message from client | PartyKit sends `{ type: "error", code, message }`. Client shows toast. |
| Unauthorized action (non-host calls kick/start) | PartyKit validates `hostId`. Send error, ignore action. |
| Battle action out of turn | PartyKit checks `currentPlayerId`. Send error, ignore action. |
| Player disconnects mid-battle | Connected player sees "Opponent disconnected — waiting for reconnect..." banner. 60-second reconnection window. After timeout, remaining player wins by forfeit. |
| Room join rejected (full) | Vercel returns 400 `{ error: "Room is full", code: "ROOM_FULL" }`. Frontend shows notification, stays on join screen. |

---

## Battle End Conditions

The only ways to end a battle:

1. **Surrender** — Player calls `declareVictory` with `method: "surrender"`. Opponent wins.
2. **Death** — Player calls `declareVictory` with `method: "death"`. Opponent wins.
3. **Self-Sacrifice** — Player narrates a self-destruct attack, then calls `declareVictory` with `method: "selfSacrifice"`. They lose. Opponent wins.

No HP bars. No damage calculation. No automated damage. Pure imagination-based battle.

---

## PartyKit Configuration

### partykit.json

```json
{
  "name": "dark-game-battle",
  "main": "src/party/index.ts"
}
```

### Party Room Naming

Each game room maps directly to a PartyKit room: the Vercel `roomCode` becomes the PartyKit room ID.

```
wss://dark-game-battle.[user].partykit.dev/room/{roomCode}?playerId={playerId}
```

---

## Vercel Configuration

### vercel.json

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/index" }
  ],
  "builds": [
    { "src": "party/index.ts", "use": "@partykit/vercel" }
  ]
}
```

Note: API routes at `/api/*` are automatically mapped to `src/api/*.ts` by Vercel framework detection. Only the PartyKit build step needs explicit config.

---

## Deprecation Plan

- Remove `/api/room/:code` (GET room state) — replaced by PartyKit `state` push on connect
- Remove `/api/room/:code/narrate` (POST narration) — replaced by PartyKit `narrate` message
- Remove `/api/room/:code/endturn` — replaced by `endTurn` message
- Remove `/api/room/:code/victory` — replaced by `declareVictory` message
- Keep `/api/draw/hand` — card drawing is still a Vercel REST call (stateless, no real-time need)
- Keep `/api/room/create` and `/api/room/join` — bootstrapping room and getting initial hand
- Remove `setInterval(fetchState, 3000)` from battle.html — replaced by PartyKit subscription

---

## Implementation Order

1. Set up PartyKit (partykit.json, party/index.ts shell, test connection)
2. Port room/state logic to PartyKit in-memory store
3. Update Vercel REST endpoints to handle `ROOM_FULL` response
4. Update battle.html: connect to PartyKit, render from `state` messages, remove polling
5. Update index.html: add Start Battle + Kick buttons, wire to PartyKit
6. Add WebSocket status indicator + reconnect logic
7. Add player disconnect detection + forfeit timer
8. Wire debate overlay to PartyKit messages
9. End-to-end test: two browsers, real-time narration, debate, victory

---

## Open Questions

None. All questions resolved during design.

---

## Spec Self-Review

- Placeholder scan: None found — all sections are concrete.
- Internal consistency: Architecture matches data model matches API matches protocol. Lobby flow is consistent with phase state machine.
- Scope check: Focused on multiplayer only. Does NOT include lobby chat, friend system, replay storage, account system. In-battle chat (the narration feed) and debate chat are both covered.
- Ambiguity check: Battle end conditions explicitly defined (no HP damage). Party room = game room naming clarified. Max 2 players enforced in API response.
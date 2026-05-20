# DARK GAME — Real-Time Multiplayer Card Battle

> DARK GAME is an imagination-based card battle game. No HP bars, no damage calculation — just pure storytelling combat. Win through superior narration, or lose by surrender, death, or self-sacrifice.

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS | Battle arena, lobby, card pools |
| REST API | Vercel / `@vercel/node` | Room bootstrap, card draws |
| WebSocket | RAILWAY | Real-time battle state, turn switching, debate |
| Card Pools | TypeScript | ~500 bilingual cards (JP/ZH/EN) |

## Architecture

```
Browser Tab 1 + 2
  ├── POST /api/room/create     → Vercel REST   (room setup, draw hand)
  ├── POST /api/room/join        → Vercel REST   (join room, draw hand)
  ├── GET  /api/pools            → Vercel REST   (card pool browser)
  ├── GET  /api/search/:keyword  → Vercel REST  (search cards)
  └── ws://dark-game-battle.stgrass3.partykit.dev/room/:code
      └── PartyKit WebSocket     (all battle state, real-time sync)

┌─────────────────────────────────────────────────────────────┐
│  VERCEL (REST)                                              │
│  api.yourdomain.vercel.app/api/*                            │
│  • Room create / join                                        │
│  • Card pools + search                                       │
│  • Static file serving (public/)                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PARTYKIT (WebSocket)                                       │
│  dark-game-battle.stgrass3.partykit.dev                     │
│  • Battle state (turn, HP, narrative log)                  │
│  • Turn switching + narration                               │
│  • Debate mode                                               │
│  • Victory / disconnect / reconnect                         │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Bilingual** — Chinese / Japanese cards + English translations (toggle in UI)
- **~500 cards** across 7 pools: Abilities, Races, Weapons, Talents, Places, Events, Summons
- **Real-time multiplayer** — PartyKit WebSocket, sub-second sync
- **Turn-based narration** — Describe your attack, switch turns, build the battlefield through imagination
- **Debate mode** — Challenge an opponent's narration, argue your case, resolve as "counts" or "void"
- **3 victory paths** — Surrender, declare death, or self-destruct
- **Disconnect detection** — 60-second forfeit timer if opponent drops
- **Host controls** — Start battle, kick waiting players
- **Auto-reconnect** — Exponential backoff up to 5 retries

## Quick Start (Local Dev)

You need three terminals:

```powershell
# Terminal 1: PartyKit WebSocket server
npx partykit dev

# Terminal 2: Vercel REST API (serves API routes + static files)
vercel dev

# Terminal 3: (optional) Old Express server for reference
node src/server.js

# Open in browser
start http://localhost:3000
```

> **Note:** PartyKit at `localhost:1999`, Vercel dev at `localhost:3000`. Both must be running simultaneously.

On localhost, `index.html` connects to PartyKit at `localhost:1999` automatically. On deployed URLs, it connects to `dark-game-battle.stgrass3.partykit.dev`.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/room/create` | POST | `{ playerName, lang }` → `{ roomCode, playerId, hand }` |
| `/api/room/join` | POST | `{ roomCode, playerName, lang }` → `{ roomCode, playerId, hand }` |
| `/api/draw/hand` | GET | `?lang=en` → `{ hand, lang }` |
| `/api/cards/hand` | GET | `?lang=en` → `{ hand, lang }` |
| `/api/pools` | GET | `?lang=en` → pools object |
| `/api/search/:keyword` | GET | `?lang=en&q=keyword` → search results |

## Client → Server Messages (PartyKit WebSocket)

All messages are JSON:

```typescript
{ type: 'startBattle' }
{ type: 'kickPlayer' }
{ type: 'narrate',     text: string }
{ type: 'endTurn' }
{ type: 'openDebate' }
{ type: 'debateMessage', text: string }
{ type: 'resolveDebate', verdict: 'counts' | 'void' }
{ type: 'declareVictory', method: 'surrender' | 'death' | 'selfSacrifice' }
{ type: 'ping' }
```

## Server → Client Messages (PartyKit WebSocket)

```typescript
{ type: 'state',     payload: RoomState }  // full state, sent on every action
{ type: 'battleStart' }
{ type: 'playerKicked' }
{ type: 'victory',    winner: string }
{ type: 'pong' }                               // response to ping
{ type: 'opponentDisconnected', timeout: number }
{ type: 'opponentReconnected' }
{ type: 'error',      code: string, message: string }
```

## RoomState Interface

```typescript
interface RoomState {
  code: string;
  phase: 'lobby' | 'ready' | 'battle' | 'debate' | 'ended';
  players: [Player, Player | null];
  currentPlayerId: string | null;
  turnNumber: number;
  narrativeLog: NarrativeEntry[];
  debateActive: boolean;
  debateEntries: DebateEntry[];
  attackNarration: string | null;
  attackPlayerId: string | null;
  winner: string | null;
  hostId: string;
}
```

## Battle Flow

```
LOBBY (waiting)
  └─ 2 players joined
      READY (host sees "Start Battle")
          └─ Host clicks START BATTLE
              BATTLE (alternating turns)
                  ├─ Player narrates attack → narrate message
                  ├─ Player clicks END TURN → switch to opponent
                  ├─ After both go → turnNumber++
                  ├─ Opponent clicks DEBATE → debate overlay opens
                  │   ├─ Both type debate messages
                  │   ├─ Attacker resolves: "COUNTS" or "VOID"
                  │   └─ Narration removed if VOID
                  └─ Declarer clicks SURRENDER / DEATH / SELF-DESTRUCT
                      ENDED (victory overlay)
```

## Project Structure

```
dark-game-battle-system/
├── public/
│   ├── index.html      # Lobby: create/join room, view pools, search
│   ├── battle.html     # Battle arena: narration, turn indicator, debate
│   └── rules.html      # Game rules
├── src/
│   ├── types.ts                     # Shared TypeScript interfaces
│   ├── data/
│   │   └── pools.ts                 # ~500 bilingual cards (JP/ZH + EN)
│   ├── api/
│   │   ├── room/create.ts            # POST /api/room/create
│   │   ├── room/join.ts             # POST /api/room/join
│   │   ├── pools/index.ts           # GET /api/pools
│   │   ├── search/[keyword].ts      # GET /api/search/:keyword
│   │   ├── draw/hand.ts             # GET /api/draw/hand
│   │   └── cards/hand.ts            # GET /api/cards/hand
│   ├── party/index.ts               # PartyKit WebSocket handler
│   ├── server.js                    # (deprecated) Old Express server
│   └── game/GameManager.js         # (deprecated) Old battle logic
├── vercel.json                      # Vercel rewrite config
├── partykit.json                    # PartyKit project config
├── tsconfig.json                    # TypeScript config
└── package.json
```

## Deployment

### PartyKit (WebSocket) — Deploy First

```powershell
cd c:\Dark\ Game\ Battle\ System
npx partykit deploy
# Output: https://dark-game-battle.[username].partykit.dev
```

Update `public/index.html`:
```javascript
const PARTYKT_HOST = 'dark-game-battle.[username].partykit.dev';
```

### Vercel (REST API + Frontend)

```powershell
# Push to GitHub first
git add -A && git commit -m "feat: multiplayer" && git push

# Or use CLI
vercel --prod
```

Vercel auto-deploys on every GitHub push.

## Troubleshooting

**`npm install` fails on Vercel / `ERR_MODULE_NOT_FOUND`**
→ `pools.js` was deleted. If Vercel shows this error, check that `src/data/pools.ts` is committed: `git push --force` after confirming the file exists.

**Cards not loading / "Failed to load card pools"**
→ Run `vercel logs` to see if `/api/pools` returns 500. Check Vercel dashboard → Deployment → Functions.

**PartyKit connection refused**
→ Verify PartyKit is deployed: `npx partykit whoami`. Check `PARTYKT_HOST` in `index.html` matches your deployed party URL.

**CORS errors**
→ All API routes set `Access-Control-Allow-Origin: *`. If using a custom domain on Vercel, update the CORS header in each route.

**Vercel build fails / TypeScript errors**
→ Vercel compiles TypeScript on-the-fly — no `tsc` in build pipeline. Ensure `package.json` has no `build` script.

**Room shows "Waiting for opponent..." even after joining**
→ Player 2 joined but the PartyKit state didn't propagate. Refresh both tabs — the state should sync on reconnect.

## Language Support

Toggle between English and Chinese at any time via the header buttons. Card text, UI labels, and battle narration all switch. PartyKit battle state uses raw text from the frontend, so language is purely cosmetic — both players can use different languages if they want.

## Credits

Built with imagination, Express, PartyKit, and Vercel.

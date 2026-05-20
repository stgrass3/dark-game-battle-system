// DARK GAME — Shared TypeScript Types

export interface Hand {
    race: string;
    weapon: string;
    abilities: [string, string, string];
    entity: string;
}

export interface Player {
    id: string;
    name: string;
    hand: Hand;
}

export type RoomPhase = 'lobby' | 'ready' | 'battle' | 'debate' | 'ended';

export interface NarrativeEntry {
    playerId: string;
    playerName: string;
    text: string;
    turn: number;
    timestamp: number;
}

export interface DebateEntry {
    playerId: string;
    playerName: string;
    text: string;
    timestamp: number;
}

export interface RoomState {
    code: string;
    phase: RoomPhase;
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

// ─── Client → Server (PartyKit WebSocket) ───────────────────────────────────

export type ClientMessage =
    | { type: 'startBattle' }
    | { type: 'kickPlayer' }
    | { type: 'narrate'; text: string }
    | { type: 'endTurn' }
    | { type: 'openDebate' }
    | { type: 'debateMessage'; text: string }
    | { type: 'resolveDebate'; verdict: 'counts' | 'void' }
    | { type: 'declareVictory'; method: 'surrender' | 'death' | 'selfSacrifice' }
    | { type: 'ping' };

export type VictoryMethod = 'surrender' | 'death' | 'selfSacrifice';

// ─── Server → Client (PartyKit WebSocket) ─────────────────────────────────────

export type ServerMessage =
    | { type: 'state'; payload: RoomState }
    | { type: 'error'; code: string; message: string }
    | { type: 'battleStart' }
    | { type: 'playerKicked' }
    | { type: 'victory'; winner: string }
    | { type: 'pong' }
    | { type: 'opponentDisconnected'; timeout: number }
    | { type: 'opponentReconnected' };
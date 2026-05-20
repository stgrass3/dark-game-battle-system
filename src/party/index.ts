import type * as Party from 'partykit/server';
import type {
    RoomState,
    ClientMessage,
    ServerMessage,
    Hand,
    NarrativeEntry,
    DebateEntry,
} from '../types';

function generateId(): string {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

function makeEmptyHand(): Hand {
    return { race: '', weapon: '', abilities: ['', '', ''], entity: '' };
}

export default class BattleRoom implements Party.Server {
    room: Party.Room;
    state: RoomState;
    private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    constructor(room: Party.Room, hostId: string) {
        this.room = room;
        this.state = {
            code: room.id,
            phase: 'lobby',
            players: [
                { id: hostId, name: '', hand: makeEmptyHand() },
                null,
            ],
            currentPlayerId: null,
            turnNumber: 1,
            narrativeLog: [],
            debateActive: false,
            debateEntries: [],
            attackNarration: null,
            attackPlayerId: null,
            winner: null,
            hostId,
        };
    }

    // ─── Connection lifecycle ─────────────────────────────────

    async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
        const url = new URL(ctx.request?.url || '', 'http://localhost');
        const playerId = url.searchParams.get('playerId') || '';
        const playerName = url.searchParams.get('playerName') || '';
        (conn as any).playerId = playerId;
        (conn as any).playerName = playerName;

        // Assign player to a slot in the room state
        this.assignPlayerSlot(playerId, playerName);

        // Send current full state to the newly connected player
        const msg = JSON.stringify({ type: 'state', payload: this.state });
        conn.send(msg);
    }

    async onClose(conn: Party.Connection) {
        const playerId = (conn as any).playerId as string;
        if (!playerId) return;

        // Clear any disconnect timer for this player
        const existing = this.disconnectTimers.get(playerId);
        if (existing) { clearTimeout(existing); this.disconnectTimers.delete(playerId); }

        if (this.state.phase === 'battle' || this.state.phase === 'debate') {
            // Notify the other player
            this.room.broadcast(JSON.stringify({ type: 'opponentDisconnected', timeout: 60 }));

            const disconnectedPlayerId = playerId;
            const timer = setTimeout(() => {
                // Opponent didn't reconnect within 60s — remaining player wins by forfeit
                const remaining = this.state.players.find(p => p?.id !== disconnectedPlayerId);
                if (remaining && this.state.phase !== 'ended') {
                    this.state.phase = 'ended';
                    this.state.winner = remaining.name;
                    this.room.broadcast(JSON.stringify({ type: 'victory', winner: remaining.name }));
                }
            }, 60_000);

            this.disconnectTimers.set(disconnectedPlayerId, timer);
        }
    }

    async onMessage(message: string, sender: Party.Connection) {
        let clientMsg: ClientMessage;
        try {
            clientMsg = JSON.parse(message) as ClientMessage;
        } catch {
            this.sendError(sender, 'INVALID_JSON', 'Malformed message');
            return;
        }

        const playerId = (sender as any).playerId as string;
        if (!playerId) {
            this.sendError(sender, 'NO_PLAYER_ID', 'playerId not set on connection');
            return;
        }

        await this.handleMessage(clientMsg, playerId, sender);
    }

    // ─── Player slot assignment ────────────────────────────────

    private assignPlayerSlot(playerId: string, playerName: string) {
        // Find if player already has a slot
        const existingIdx = this.state.players.findIndex(p => p?.id === playerId);
        if (existingIdx >= 0) return; // already assigned

        // Assign to first empty slot
        if (!this.state.players[0]) {
            this.state.players[0] = { id: playerId, name: playerName, hand: makeEmptyHand() };
            this.state.hostId = playerId;
        } else if (!this.state.players[1]) {
            this.state.players[1] = { id: playerId, name: playerName, hand: makeEmptyHand() };
            this.state.phase = 'ready';
        } else {
            // Room is full — max 2 players
            // This branch shouldn't be reachable via normal flow (host denies), but guard anyway
        }
    }

    // ─── Message handler (main state machine) ─────────────────

    private async handleMessage(msg: ClientMessage, playerId: string, conn: Party.Connection) {
        switch (msg.type) {

            case 'ping': {
                conn.send(JSON.stringify({ type: 'pong' }));
                break;
            }

            case 'startBattle': {
                if (playerId !== this.state.hostId) {
                    this.sendError(conn, 'UNAUTHORIZED', 'Only the host can start the battle');
                    return;
                }
                if (this.state.phase !== 'ready') {
                    this.sendError(conn, 'INVALID_PHASE', 'Need 2 players to start battle');
                    return;
                }
                this.state.phase = 'battle';
                this.state.currentPlayerId = this.state.players[0].id;
                this.room.broadcast(JSON.stringify({ type: 'battleStart' }));
                this.broadcastFullState();
                break;
            }

            case 'kickPlayer': {
                if (playerId !== this.state.hostId) {
                    this.sendError(conn, 'UNAUTHORIZED', 'Only the host can kick players');
                    return;
                }
                const player2 = this.state.players[1];
                if (!player2) {
                    this.sendError(conn, 'NO_PLAYER', 'No player to kick');
                    return;
                }
                // Close Player 2's connection
                for (const c of this.room.getConnections()) {
                    if ((c as any).playerId === player2.id) {
                        c.send(JSON.stringify({ type: 'playerKicked' }));
                        c.close();
                        break;
                    }
                }
                this.state.phase = 'lobby';
                this.state.players[1] = null;
                this.state.currentPlayerId = null;
                this.broadcastFullState();
                break;
            }

            case 'narrate': {
                if (this.state.phase !== 'battle') {
                    this.sendError(conn, 'INVALID_PHASE', 'Can only narrate during battle');
                    return;
                }
                if (playerId !== this.state.currentPlayerId) {
                    this.sendError(conn, 'NOT_YOUR_TURN', 'Wait for your turn');
                    return;
                }
                if (!msg.text || typeof msg.text !== 'string' || !msg.text.trim()) {
                    this.sendError(conn, 'EMPTY_NARRATION', 'Narration cannot be empty');
                    return;
                }
                if (this.state.debateActive) {
                    this.sendError(conn, 'DEBATE_ACTIVE', 'Resolve the current debate first');
                    return;
                }

                const player = this.state.players.find(p => p?.id === playerId);
                if (!player) return;

                const entry: NarrativeEntry = {
                    playerId,
                    playerName: player.name,
                    text: msg.text.trim(),
                    turn: this.state.turnNumber,
                    timestamp: Date.now(),
                };

                this.state.narrativeLog.push(entry);
                this.broadcastFullState();
                break;
            }

            case 'endTurn': {
                if (this.state.phase !== 'battle') {
                    this.sendError(conn, 'INVALID_PHASE', 'Not in battle');
                    return;
                }
                if (playerId !== this.state.currentPlayerId) {
                    this.sendError(conn, 'NOT_YOUR_TURN', 'Not your turn');
                    return;
                }
                if (this.state.debateActive) {
                    this.sendError(conn, 'DEBATE_ACTIVE', 'Resolve the current debate first');
                    return;
                }

                // Switch to opponent
                const currentIdx = this.state.players.findIndex(p => p?.id === playerId);
                const opponent = this.state.players[currentIdx === 0 ? 1 : 0];
                if (opponent) {
                    this.state.currentPlayerId = opponent.id;
                }

                // Increment turnNumber when returning to Player 1 (full round complete)
                if (this.state.currentPlayerId === this.state.players[0].id) {
                    this.state.turnNumber++;
                }

                this.broadcastFullState();
                break;
            }

            case 'openDebate': {
                if (this.state.phase !== 'battle') {
                    this.sendError(conn, 'INVALID_PHASE', 'Can only debate during battle');
                    return;
                }
                if (this.state.debateActive) {
                    this.sendError(conn, 'DEBATE_ACTIVE', 'Debate already in progress');
                    return;
                }

                const lastEntry = this.state.narrativeLog[this.state.narrativeLog.length - 1];
                if (!lastEntry) {
                    this.sendError(conn, 'NO_NARRATION', 'No narration to debate');
                    return;
                }
                if (lastEntry.playerId === playerId) {
                    this.sendError(conn, 'CANNOT_DEBATE_SELF', 'Cannot debate your own narration');
                    return;
                }

                this.state.debateActive = true;
                this.state.attackNarration = lastEntry.text;
                this.state.attackPlayerId = lastEntry.playerId;
                this.state.debateEntries = [];
                this.broadcastFullState();
                break;
            }

            case 'debateMessage': {
                if (!this.state.debateActive) {
                    this.sendError(conn, 'NO_DEBATE', 'No active debate');
                    return;
                }
                if (!msg.text || typeof msg.text !== 'string' || !msg.text.trim()) {
                    this.sendError(conn, 'EMPTY_MESSAGE', 'Message cannot be empty');
                    return;
                }

                const player = this.state.players.find(p => p?.id === playerId);
                if (!player) return;

                const entry: DebateEntry = {
                    playerId,
                    playerName: player.name,
                    text: msg.text.trim(),
                    timestamp: Date.now(),
                };

                this.state.debateEntries.push(entry);
                this.broadcastFullState();
                break;
            }

            case 'resolveDebate': {
                if (!this.state.debateActive) {
                    this.sendError(conn, 'NO_DEBATE', 'No active debate');
                    return;
                }
                if (playerId !== this.state.attackPlayerId) {
                    this.sendError(conn, 'UNAUTHORIZED', 'Only the attacker can resolve the debate');
                    return;
                }
                if (msg.verdict !== 'counts' && msg.verdict !== 'void') {
                    this.sendError(conn, 'INVALID_VERDICT', 'Verdict must be "counts" or "void"');
                    return;
                }

                // If void, discard the contested narration
                if (msg.verdict === 'void' && this.state.narrativeLog.length > 0) {
                    this.state.narrativeLog.pop();
                }

                this.state.debateActive = false;
                this.state.debateEntries = [];
                this.state.attackNarration = null;
                this.state.attackPlayerId = null;
                this.broadcastFullState();
                break;
            }

            case 'declareVictory': {
                if (this.state.phase !== 'battle' && this.state.phase !== 'debate') {
                    this.sendError(conn, 'INVALID_PHASE', 'Battle has not started');
                    return;
                }

                const validMethods = ['surrender', 'death', 'selfSacrifice'];
                if (!validMethods.includes(msg.method)) {
                    this.sendError(conn, 'INVALID_METHOD', 'Invalid victory declaration method');
                    return;
                }

                // Declarer loses — opponent is the winner
                const declarer = this.state.players.find(p => p?.id === playerId);
                const winner = this.state.players.find(p => p?.id !== playerId);

                if (!declarer || !winner) return;

                const methodText: Record<string, string> = {
                    surrender: '宣布投降 / Surrendered',
                    death: '宣布死亡 / Declared death',
                    selfSacrifice: '自爆 / Self-destructed',
                };

                this.state.phase = 'ended';
                this.state.winner = winner.name;
                this.state.narrativeLog.push({
                    playerId,
                    playerName: declarer.name,
                    text: methodText[msg.method],
                    turn: this.state.turnNumber,
                    timestamp: Date.now(),
                });

                this.room.broadcast(JSON.stringify({ type: 'victory', winner: winner.name }));
                this.broadcastFullState();
                break;
            }

            default: {
                this.sendError(conn, 'UNKNOWN_MESSAGE', 'Unrecognized message type');
            }
        }
    }

    // ─── Helpers ──────────────────────────────────────────────

    private broadcastFullState(excludeConn?: Party.Connection) {
        const msg = JSON.stringify({ type: 'state', payload: this.state });
        if (excludeConn) {
            for (const conn of this.room.getConnections()) {
                if (conn !== excludeConn) conn.send(msg);
            }
        } else {
            this.room.broadcast(msg);
        }
    }

    private sendError(conn: Party.Connection, code: string, message: string) {
        conn.send(JSON.stringify({ type: 'error', code, message }));
    }
}

// ──────────────────────────────────────────────────────────────
// PartyKit entry point
// ──────────────────────────────────────────────────────────────

export const onConnect = async (
    conn: Party.Connection,
    room: Party.Room,
    ctx: Party.ConnectionContext,
) => {
    // Get or create the BattleRoom instance for this room ID
    let battleRoom = (room as any)._battleRoom as BattleRoom | undefined;
    if (!battleRoom) {
        // Use the room ID as a placeholder hostId; assignPlayerSlot corrects this
        battleRoom = new BattleRoom(room, `placeholder-host-${room.id}`);
        (room as any)._battleRoom = battleRoom;
    }

    await battleRoom.onConnect(conn, ctx);
};

export const onMessage = async (
    message: string,
    sender: Party.Connection,
    room: Party.Room,
) => {
    const battleRoom = (room as any)._battleRoom as BattleRoom | undefined;
    if (!battleRoom) return;
    await battleRoom.onMessage(message, sender);
};

export const onClose = async (
    conn: Party.Connection,
    room: Party.Room,
) => {
    const battleRoom = (room as any)._battleRoom as BattleRoom | undefined;
    if (!battleRoom) return;
    await battleRoom.onClose(conn);
};
'use strict';

// ─── Types (documentation) ─────────────────────────────────────────────────
// Hand: { race, weapon, abilities: [3], entity }
// RoomState: { code, phase, players, currentPlayerId, turnNumber, ... }
// ClientMessage: any of the message types
// Connection extra: { playerId, playerName, roomId }

// ─── Room state helpers ──────────────────────────────────────────────────────
function generateId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

function makeEmptyHand() {
    return { race: '', weapon: '', abilities: ['', '', ''], entity: '' };
}

// ─── BattleRoom ───────────────────────────────────────────────────────────────
class BattleRoom {
    constructor(roomId) {
        this.roomId = roomId;
        // Fresh state every time — no ghost state
        this.state = {
            code: roomId,
            phase: 'lobby',
            players: [
                { id: '', name: '', hand: makeEmptyHand() },
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
            hostId: null,
        };
        this.hostId = null;
        this.disconnectTimers = new Map();
    }

    // Broadcast full state to all connections in this room
    broadcast(excludeConn = null) {
        const msg = JSON.stringify({ type: 'state', payload: this.state });
        const { getConnections, send } = findConnectionsForRoom(this.roomId);
        for (const c of getConnections()) {
            if (c !== excludeConn && !c._closing) {
                try { send(c, msg); } catch (_) {}
            }
        }
    }

    sendError(conn, code, message) {
        try { send(conn, JSON.stringify({ type: 'error', code, message })); } catch (_) {}
    }

    onConnect(conn, playerId, playerName, playerHand, allConnections) {
        // Tag connection with player info + hand
        conn._playerId = playerId;
        conn._playerName = playerName;
        conn._roomId = this.roomId;
        conn._playerHand = playerHand || makeEmptyHand();

        // Assign player to slot
        const alreadyAssigned = this.state.players.some(p => p?.id === playerId);
        if (!alreadyAssigned) {
            const hand = playerHand || makeEmptyHand();
            if (!this.state.players[0]?.id) {
                this.state.players[0] = { id: playerId, name: playerName, hand };
                this.hostId = playerId;
                this.state.hostId = playerId;
            } else if (!this.state.players[1]) {
                this.state.players[1] = { id: playerId, name: playerName, hand };
                this.state.phase = 'ready';
            } else {
                // Room full — send error but don't crash
                this.sendError(conn, 'ROOM_FULL', 'Room is full');
                return;
            }
        }

        // Send current state to the new connection
        try { send(conn, JSON.stringify({ type: 'state', payload: this.state })); } catch (_) {}

        // Broadcast updated state to everyone else
        this.broadcast(conn);
    }

    onClose(conn) {
        const playerId = conn._playerId;
        if (!playerId) return;

        // Clear disconnect timer if any
        const existing = this.disconnectTimers.get(playerId);
        if (existing) { clearTimeout(existing); this.disconnectTimers.delete(playerId); }

        // Notify other player of disconnect (during battle only)
        if (this.state.phase === 'battle' || this.state.phase === 'debate') {
            const disconnectedPlayerId = playerId;
            this.broadcast(); // alert remaining player

            const timer = setTimeout(() => {
                const s = rooms.get(this.roomId);
                if (s && s.state.phase !== 'ended') {
                    s.state.phase = 'ended';
                    const remaining = s.state.players.find(p => p?.id !== disconnectedPlayerId);
                    if (remaining) s.state.winner = remaining.name;
                    s.broadcast();
                }
            }, 60_000);
            this.disconnectTimers.set(disconnectedPlayerId, timer);
        }
    }

    onMessage(msgStr, sender) {
        const playerId = sender._playerId;
        if (!playerId) { this.sendError(sender, 'NO_PLAYER_ID', ''); return; }

        let msg;
        try { msg = JSON.parse(msgStr); } catch {
            this.sendError(sender, 'INVALID_JSON', 'Malformed message');
            return;
        }

        switch (msg.type) {
            case 'ping': {
                try { send(sender, JSON.stringify({ type: 'pong' })); } catch (_) {}
                break;
            }
            case 'startBattle': {
                if (playerId !== this.hostId) { this.sendError(sender, 'UNAUTHORIZED', 'Only host can start'); return; }
                if (this.state.phase !== 'ready') { this.sendError(sender, 'INVALID_PHASE', 'Need 2 players'); return; }
                this.state.phase = 'battle';
                this.state.currentPlayerId = this.state.players[0].id;
                this.broadcast();
                // Also send battleStart
                const { getConnections, send: s2 } = findConnectionsForRoom(this.roomId);
                for (const c of getConnections()) {
                    try { s2(c, JSON.stringify({ type: 'battleStart' })); } catch (_) {}
                }
                break;
            }
            case 'kickPlayer': {
                if (playerId !== this.hostId) { this.sendError(sender, 'UNAUTHORIZED', 'Only host can kick'); return; }
                const target = this.state.players[1];
                if (!target) { this.sendError(sender, 'NO_PLAYER', 'No player to kick'); return; }
                const { getConnections, send: s3 } = findConnectionsForRoom(this.roomId);
                for (const c of getConnections()) {
                    if (c._playerId === target.id) {
                        try { s3(c, JSON.stringify({ type: 'playerKicked' })); c._closing = true; c.close(); } catch (_) {}
                        break;
                    }
                }
                this.state.players[1] = null;
                this.state.phase = 'lobby';
                this.state.currentPlayerId = null;
                this.broadcast();
                break;
            }
            case 'narrate': {
                if (this.state.phase !== 'battle') { this.sendError(sender, 'INVALID_PHASE', 'Not in battle'); return; }
                if (playerId !== this.state.currentPlayerId) { this.sendError(sender, 'NOT_YOUR_TURN', 'Not your turn'); return; }
                if (this.state.debateActive) { this.sendError(sender, 'DEBATE_ACTIVE', 'Resolve debate first'); return; }
                if (!msg.text || typeof msg.text !== 'string' || !msg.text.trim()) {
                    this.sendError(sender, 'EMPTY_NARRATION', 'Narration cannot be empty');
                    return;
                }
                const player = this.state.players.find(p => p?.id === playerId);
                if (!player) return;
                this.state.narrativeLog.push({
                    playerId, playerName: player.name,
                    text: msg.text.trim(), turn: this.state.turnNumber, timestamp: Date.now()
                });
                this.broadcast();
                break;
            }
            case 'endTurn': {
                if (this.state.phase !== 'battle') { this.sendError(sender, 'INVALID_PHASE', 'Not in battle'); return; }
                if (playerId !== this.state.currentPlayerId) { this.sendError(sender, 'NOT_YOUR_TURN', 'Not your turn'); return; }
                if (this.state.debateActive) { this.sendError(sender, 'DEBATE_ACTIVE', 'Resolve debate first'); return; }
                const currentIdx = this.state.players.findIndex(p => p?.id === playerId);
                const opponent = this.state.players[currentIdx === 0 ? 1 : 0];
                if (opponent) this.state.currentPlayerId = opponent.id;
                if (this.state.currentPlayerId === this.state.players[0]?.id) this.state.turnNumber++;
                this.broadcast();
                break;
            }
            case 'openDebate': {
                if (this.state.phase !== 'battle') { this.sendError(sender, 'INVALID_PHASE', 'Not in battle'); return; }
                if (this.state.debateActive) { this.sendError(sender, 'DEBATE_ACTIVE', 'Already in debate'); return; }
                const lastEntry = this.state.narrativeLog[this.state.narrativeLog.length - 1];
                if (!lastEntry) { this.sendError(sender, 'NO_NARRATION', 'No narration to debate'); return; }
                if (lastEntry.playerId === playerId) { this.sendError(sender, 'CANNOT_DEBATE_SELF', 'Cannot debate own narration'); return; }
                this.state.debateActive = true;
                this.state.attackNarration = lastEntry.text;
                this.state.attackPlayerId = lastEntry.playerId;
                this.state.debateEntries = [];
                this.broadcast();
                break;
            }
            case 'debateMessage': {
                if (!this.state.debateActive) { this.sendError(sender, 'NO_DEBATE', 'No active debate'); return; }
                if (!msg.text || typeof msg.text !== 'string' || !msg.text.trim()) {
                    this.sendError(sender, 'EMPTY_MESSAGE', 'Cannot be empty'); return;
                }
                const player = this.state.players.find(p => p?.id === playerId);
                if (!player) return;
                this.state.debateEntries.push({
                    playerId, playerName: player.name,
                    text: msg.text.trim(), timestamp: Date.now()
                });
                this.broadcast();
                break;
            }
            case 'resolveDebate': {
                if (!this.state.debateActive) { this.sendError(sender, 'NO_DEBATE', 'No active debate'); return; }
                if (playerId !== this.state.attackPlayerId) { this.sendError(sender, 'UNAUTHORIZED', 'Only attacker resolves'); return; }
                if (msg.verdict !== 'counts' && msg.verdict !== 'void') {
                    this.sendError(sender, 'INVALID_VERDICT', 'Must be counts or void'); return;
                }
                if (msg.verdict === 'void' && this.state.narrativeLog.length > 0) {
                    this.state.narrativeLog.pop();
                }
                this.state.debateActive = false;
                this.state.debateEntries = [];
                this.state.attackNarration = null;
                this.state.attackPlayerId = null;
                this.broadcast();
                break;
            }
            case 'declareVictory': {
                if (this.state.phase !== 'battle' && this.state.phase !== 'debate') {
                    this.sendError(sender, 'INVALID_PHASE', 'Battle not started'); return;
                }
                const validMethods = ['surrender', 'death', 'selfSacrifice'];
                if (!validMethods.includes(msg.method)) {
                    this.sendError(sender, 'INVALID_METHOD', 'Invalid method'); return;
                }
                const declarer = this.state.players.find(p => p?.id === playerId);
                const winner = this.state.players.find(p => p?.id !== playerId);
                if (!declarer || !winner) return;
                const methodText = {
                    surrender: '宣布投降 / Surrendered',
                    death: '宣布死亡 / Declared death',
                    selfSacrifice: '自爆 / Self-destructed',
                };
                this.state.phase = 'ended';
                this.state.winner = winner.name;
                this.state.narrativeLog.push({
                    playerId, playerName: declarer.name,
                    text: methodText[msg.method], turn: this.state.turnNumber, timestamp: Date.now()
                });
                const { getConnections, send: s4 } = findConnectionsForRoom(this.roomId);
                for (const c of getConnections()) {
                    try { s4(c, JSON.stringify({ type: 'victory', winner: winner.name })); } catch (_) {}
                }
                this.broadcast();
                break;
            }
            default: {
                this.sendError(sender, 'UNKNOWN_MESSAGE', 'Unrecognized type');
            }
        }
    }
}

// ─── Global state ─────────────────────────────────────────────────────────────
const rooms = new Map();       // roomId → BattleRoom
const connections = new Map(); // WebSocket → roomId  (for broadcast targeting)
let allConnections = [];        // flat list of all active connections

function findConnectionsForRoom(roomId) {
    return {
        getConnections: () => allConnections.filter(c => c._roomId === roomId),
        send: (conn, msg) => {
            if (conn.readyState === 1) conn.send(msg);
        }
    };
}

function send(conn, msg) {
    if (conn.readyState === 1) conn.send(msg);
}

function getOrCreateRoom(roomId) {
    const existing = rooms.get(roomId);
    if (existing) return existing;
    const room = new BattleRoom(roomId);
    rooms.set(roomId, room);
    return room;
}

module.exports = { BattleRoom, getOrCreateRoom, findConnectionsForRoom, rooms, connections, allConnections };
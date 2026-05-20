/**
 * @deprecated This module is superseded by src/party/index.ts (PartyKit battle handler).
 * See src/types.ts for the new RoomState and ClientMessage/ServerMessage types.
 */
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
        if (!player || player.id !== playerId) return { error: 'Not your turn' };
        room.narrativeLog.push({
            player: player.name,
            playerId: player.id,
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
        if (!player || player.id !== playerId) return { error: 'Not your turn' };

        // Can only end turn if both players are present
        if (!room.player2) return { error: 'Waiting for opponent' };

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
            environment: room.environment || null,
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
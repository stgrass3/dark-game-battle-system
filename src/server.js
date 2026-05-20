/**
 * @deprecated This file is superseded by the new multiplayer architecture:
 *   - REST API: src/api/room/create.ts, src/api/room/join.ts, src/api/cards/hand.ts
 *   - WebSocket: src/party/index.ts (PartyKit)
 *   - Frontend: public/index.html, public/battle.html (PartyKit WebSocket client)
 * This server.js and all its routes are replaced entirely.
 * See: src/types.ts for shared TypeScript interfaces.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const { cardPools, getCards } = require('./data/pools');
const GameManager = require('./game/GameManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize game manager
const gameManager = new GameManager();

// Get all pools
app.get('/api/pools', (req, res) => {
    const lang = req.query.lang || 'en';
    res.json({
        abilities: getCards(cardPools.pool, lang),
        races: getCards(cardPools.racePool, lang),
        weapons: getCards(cardPools.WeapenPool, lang),
        talents: getCards(cardPools.TalentPool, lang),
        places: getCards(cardPools.PlacePool, lang),
        events: getCards(cardPools.EventPool, lang),
        summons: getCards(cardPools.SummonPool, lang)
    });
});

// Draw a full hand (Standard Mode: 1 race, 1 weapon, 3 abilities, 1 entity)
// IMPORTANT: This route must be BEFORE /api/draw/:poolType
app.get('/api/draw/hand', (req, res) => {
    const lang = req.query.lang || 'en';

    const drawFromPool = (pool) => {
        const rawCard = pool[Math.floor(Math.random() * pool.length)];
        return lang === 'en' ? rawCard[1] : rawCard[0];
    };

    const hand = {
        race: drawFromPool(cardPools.racePool),
        weapon: drawFromPool(cardPools.WeapenPool),
        abilities: [
            drawFromPool(cardPools.pool),
            drawFromPool(cardPools.pool),
            drawFromPool(cardPools.pool)
        ],
        entity: drawFromPool(cardPools.SummonPool)
    };

    console.log('Draw hand response:', JSON.stringify({ hand, lang }));
    res.json({ hand, lang });
});

// Draw a single random card from a pool
app.get('/api/draw/:poolType', (req, res) => {
    const { poolType } = req.params;
    const lang = req.query.lang || 'en';
    const poolKey = poolType === 'abilities' ? 'pool' :
                    poolType === 'races' ? 'racePool' :
                    poolType === 'weapons' ? 'WeapenPool' :
                    poolType === 'talents' ? 'TalentPool' :
                    poolType === 'places' ? 'PlacePool' :
                    poolType === 'events' ? 'EventPool' : 'SummonPool';

    const pool = cardPools[poolKey];
    if (!pool) {
        return res.status(400).json({ error: 'Invalid pool type' });
    }

    const rawCard = pool[Math.floor(Math.random() * pool.length)];
    const card = lang === 'en' ? rawCard[1] : rawCard[0];
    res.json({ card, poolType, lang });
});

// Search cards across all pools
app.get('/api/search/:keyword', (req, res) => {
    const { keyword } = req.params;
    const lowerKeyword = keyword.toLowerCase();
    const results = {};

    for (const [poolName, pool] of Object.entries(cardPools)) {
        const matches = pool.filter(card =>
            card.toLowerCase().includes(lowerKeyword)
        );
        if (matches.length > 0) {
            results[poolName] = matches;
        }
    }

    res.json(results);
});

// Get pool statistics
app.get('/api/stats', (req, res) => {
    const stats = {};
    for (const [poolName, pool] of Object.entries(cardPools)) {
        stats[poolName] = pool.length;
    }
    res.json(stats);
});

// ========== ROOM ROUTES ==========

// Create a new room
app.post('/api/room/create', (req, res) => {
    console.log('Room create request:', req.body);
    const { playerName, hand, lang } = req.body;
    if (!playerName || !hand) {
        return res.status(400).json({ error: 'playerName and hand required' });
    }
    const rawEnv = cardPools.PlacePool[Math.floor(Math.random() * cardPools.PlacePool.length)];
    const environment = lang === 'zh' ? rawEnv[0] : rawEnv[1];
    const { room, playerId } = gameManager.createRoom(playerName, hand);
    room.environment = environment;
    res.json({
        roomCode: room.code,
        playerId,
        phase: room.phase,
        message: 'Room created. Share code with opponent.'
    });
});

// Join existing room
app.post('/api/room/join', (req, res) => {
    const { roomCode, playerName, hand, lang } = req.body;
    if (!roomCode || !playerName || !hand) {
        return res.status(400).json({ error: 'roomCode, playerName, and hand required' });
    }
    const result = gameManager.joinRoom(roomCode, playerName, hand);
    if (result.error) return res.status(400).json(result);

    // Update environment to match host's language if needed
    if (lang) {
        const rawEnv = cardPools.PlacePool.find(p => p[1] === result.room.environment || p[0] === result.room.environment);
        if (rawEnv) {
            result.room.environment = lang === 'zh' ? rawEnv[0] : rawEnv[1];
        }
    }

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

app.listen(PORT, () => {
    console.log(`DARK GAME server running on http://localhost:${PORT}`);
});

module.exports = app;
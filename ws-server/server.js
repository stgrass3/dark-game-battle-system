'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const { getOrCreateRoom, rooms, allConnections } = require('./battle-room');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
        return;
    }
    // All other routes: 404 (WS upgrade handles the rest)
    res.writeHead(404);
    res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    // Parse playerId and playerName from query string
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const playerId = url.searchParams.get('playerId') || '';
    const playerName = url.searchParams.get('playerName') || '';
    const roomId = url.searchParams.get('room') || '';

    if (!roomId || !playerId) {
        ws.close(1008, 'Missing room or playerId');
        return;
    }

    // Track connection
    ws._roomId = roomId;
    ws._playerId = playerId;
    ws._playerName = playerName;
    allConnections.push(ws);

    // Create/fresh room and register player
    const room = getOrCreateRoom(roomId);
    room.onConnect(ws, playerId, playerName, allConnections);

    ws.on('message', (data) => {
        const room = rooms.get(ws._roomId);
        if (room) {
            room.onMessage(data.toString(), ws);
        }
    });

    ws.on('close', () => {
        const room = rooms.get(ws._roomId);
        if (room) room.onClose(ws);
        // Remove from allConnections
        const idx = allConnections.indexOf(ws);
        if (idx >= 0) allConnections.splice(idx, 1);
        // Clean up empty rooms after a delay
        if (allConnections.filter(c => c._roomId === ws._roomId).length === 0) {
            setTimeout(() => {
                const stillEmpty = !allConnections.some(c => c._roomId === ws._roomId);
                if (stillEmpty) rooms.delete(ws._roomId);
            }, 60_000);
        }
    });

    ws.on('error', (err) => {
        console.error('WS error:', err.message);
    });
});

server.listen(parseInt(PORT, 10), HOST, () => {
    console.log(`DARK GAME WS server running on ${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down WS server...');
    wss.close();
    server.close();
    process.exit(0);
});
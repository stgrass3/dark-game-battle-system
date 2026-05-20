const { drawHand } = await import('../data.js');

function generateId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const { roomCode, playerName, lang = 'en' } = req.body || {};

    if (!roomCode || !playerName || !playerName.trim()) {
        res.status(400).json({ error: 'roomCode, playerName required' });
        return;
    }

    const playerId = generateId();
    const hand = drawHand(lang);

    res.status(200).json({
        roomCode,
        playerId,
        hand,
        phase: 'ready',
        partyUrl: `wss://dark-game-battle.stgrass3.partykit.dev/room/${roomCode}`,
    });
}
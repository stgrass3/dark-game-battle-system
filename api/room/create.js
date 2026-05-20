const { cardPools } = await import('./data.js');

function generateId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

function drawHand(lang) {
    const draw = (pool) => {
        const c = pool[Math.floor(Math.random() * pool.length)];
        return lang === 'en' ? (c[1] || c[0]) : (c[0] || c[1]);
    };
    return {
        race: draw(cardPools.racePool),
        weapon: draw(cardPools.WeapenPool),
        abilities: [draw(cardPools.pool), draw(cardPools.pool), draw(cardPools.pool)],
        entity: draw(cardPools.SummonPool),
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const { playerName, lang = 'en' } = req.body || {};

    if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
        res.status(400).json({ error: 'playerName required' });
        return;
    }

    const roomCode = generateRoomCode();
    const playerId = generateId();
    const hand = drawHand(lang);

    res.status(200).json({
        roomCode,
        playerId,
        hand,
        phase: 'lobby',
        partyUrl: `wss://dark-game-battle.stgrass3.partykit.dev/room/${roomCode}`,
    });
}
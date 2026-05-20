import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cardPools } from '../src/data/pools';
import type { Hand } from '../src/types';

function generateId(): string {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

function drawHand(lang: string): Hand {
    const drawFrom = (pool: [string, string][]) =>
        (lang === 'en' ? pool[Math.floor(Math.random() * pool.length)][1] : pool[Math.floor(Math.random() * pool.length)][0]);
    return {
        race: drawFrom(cardPools.racePool),
        weapon: drawFrom(cardPools.WeapenPool),
        abilities: [drawFrom(cardPools.pool), drawFrom(cardPools.pool), drawFrom(cardPools.pool)],
        entity: drawFrom(cardPools.SummonPool),
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const hand = drawHand(lang as string);

    res.status(200).json({
        roomCode,
        playerId,
        hand,
        phase: 'ready',
        partyUrl: `wss://dark-game-battle.stgrass3.partykit.dev/room/${roomCode}`,
    });
}
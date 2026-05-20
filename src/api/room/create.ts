import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cardPools } from '../data/pools';
import type { Hand } from '../types';

function generateId(): string {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// In-memory store for rooms created via Vercel REST
// Note: This survives across requests within the same process instance.
// Room state lives in PartyKit — this store only holds minimal metadata
// for validation before a player connects to PartyKit WebSocket.
const roomMetaStore = new Map<string, { hostId: string; phase: string }>();

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

    const { playerName, lang = 'en' } = req.body || {};

    if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
        res.status(400).json({ error: 'playerName required' });
        return;
    }

    const roomCode = generateRoomCode();
    const playerId = generateId();
    const hand = drawHand(lang as string);

    // Store minimal metadata for join validation
    roomMetaStore.set(roomCode, { hostId: playerId, phase: 'lobby' });

    res.status(200).json({
        roomCode,
        playerId,
        hand,
        phase: 'lobby',
        partyUrl: `wss://dark-game-battle.${process.env.PARTYKIT_HOST || '[your-username]'}.partykit.dev/room/${roomCode}`,
    });
}

export { roomMetaStore };
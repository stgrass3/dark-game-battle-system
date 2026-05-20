import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cardPools } from '../data/pools';
import type { Hand } from '../types';

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

    // Note: Room state lives in PartyKit due to Vercel's serverless cold starts.
    // Vercel REST layer only handles card draws. Room capacity is enforced by
    // PartyKit when a player opens their WebSocket connection. If the room
    // is full, the player's WebSocket connect attempt returns ROOM_FULL error.
    //
    // If this Vercel instance has no record of the room (cold start scenario),
    // it will return "Room not found" and prompt the player to try again or
    // create a new room. A durable storage layer (Upstash Redis) can be added
    // for persistent room tracking across cold starts.

    const playerId = generateId();
    const hand = drawHand(lang as string);

    res.status(200).json({
        roomCode,
        playerId,
        hand,
        phase: 'ready',
        partyUrl: `wss://dark-game-battle.${process.env.PARTYKIT_HOST || '[your-username]'}.partykit.dev/room/${roomCode}`,
    });
}
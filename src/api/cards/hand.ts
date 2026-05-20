import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cardPools } from '../data/pools';
import type { Hand } from '../types';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const lang = (req.query.lang as string) || 'en';

    const drawFromPool = (pool: [string, string][]): string => {
        const card = pool[Math.floor(Math.random() * pool.length)];
        return lang === 'en' ? card[1] : card[0];
    };

    const hand: Hand = {
        race: drawFromPool(cardPools.racePool),
        weapon: drawFromPool(cardPools.WeapenPool),
        abilities: [
            drawFromPool(cardPools.pool),
            drawFromPool(cardPools.pool),
            drawFromPool(cardPools.pool),
        ],
        entity: drawFromPool(cardPools.SummonPool),
    };

    res.status(200).json({ hand, lang });
}
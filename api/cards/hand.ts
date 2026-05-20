import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cardPools } from '../src/data/pools';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const lang = (req.query.lang as string) || 'en';

    const drawFrom = (pool: [string, string][]): string => {
        const card = pool[Math.floor(Math.random() * pool.length)];
        return (lang === 'en' || lang === 'en-US') ? card[1] : card[0];
    };

    const hand = {
        race: drawFrom(cardPools.racePool),
        weapon: drawFrom(cardPools.WeapenPool),
        abilities: [
            drawFrom(cardPools.pool),
            drawFrom(cardPools.pool),
            drawFrom(cardPools.pool),
        ],
        entity: drawFrom(cardPools.SummonPool),
    };

    res.status(200).json({ hand, lang });
}
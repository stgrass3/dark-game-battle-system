import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cardPools } from '../src/data/pools';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const lang = (req.query.lang as string) || 'en';
    const keyword = (req.query.keyword as string || '').toLowerCase().trim();

    if (!keyword) {
        res.status(200).json({});
        return;
    }

    const results: Record<string, string[]> = {};

    const getCard = (card: [string, string]): string =>
        (lang === 'en' || lang === 'en-US') ? card[1] : card[0];

    const matches = (text: string) => text.toLowerCase().includes(keyword);

    const poolMap: Record<string, [string, [string, string][]]> = {
        abilities: ['abilities', cardPools.pool],
        races: ['races', cardPools.racePool],
        weapons: ['weapons', cardPools.WeapenPool],
        talents: ['talents', cardPools.TalentPool],
        places: ['places', cardPools.PlacePool],
        events: ['events', cardPools.EventPool],
        summons: ['summons', cardPools.SummonPool],
    };

    for (const [, [key, pool]] of Object.entries(poolMap)) {
        const found = pool
            .filter(card => matches(getCard(card)))
            .map(getCard);
        if (found.length > 0) {
            results[key] = found;
        }
    }

    res.status(200).json(results);
}
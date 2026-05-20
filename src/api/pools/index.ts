import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cardPools } from '../data/pools';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const lang = (req.query.lang as string) || 'en';

    // Return pools in requested language
    // pool → abilities, racePool → races, WeapenPool → weapons, etc.
    const pools: Record<string, string[]> = {};

    const getCards = (pool: [string, string][]): string[] =>
        pool.map(card => (lang === 'en' || lang === 'en-US') ? card[1] : card[0]);

    pools.abilities = getCards(cardPools.pool);
    pools.races = getCards(cardPools.racePool);
    pools.weapons = getCards(cardPools.WeapenPool);
    pools.talents = getCards(cardPools.TalentPool);
    pools.places = getCards(cardPools.PlacePool);
    pools.events = getCards(cardPools.EventPool);
    pools.summons = getCards(cardPools.SummonPool);

    res.status(200).json(pools);
}
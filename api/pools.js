const { cardPools } = await import('./data.js');

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const lang = req.query.lang || 'en';

    const pools = {};
    const getCards = (pool) =>
        pool.map(card => lang === 'en' ? (card[1] || card[0]) : (card[0] || card[1]));

    pools.abilities = getCards(cardPools.pool);
    pools.races = getCards(cardPools.racePool);
    pools.weapons = getCards(cardPools.WeapenPool);
    pools.talents = getCards(cardPools.TalentPool);
    pools.places = getCards(cardPools.PlacePool);
    pools.events = getCards(cardPools.EventPool);
    pools.summons = getCards(cardPools.SummonPool);

    res.status(200).json(pools);
}
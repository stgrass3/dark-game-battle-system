const { cardPools } = await import('./data.js');

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const lang = req.query.lang || 'en';

    // Handle /api/search?q=...
    if (req.query.q !== undefined) {
        const keyword = (req.query.q || '').toLowerCase().trim();
        if (!keyword) { res.status(200).json({}); return; }

        const results = {};
        const getCard = (card) => lang === 'en' ? (card[1] || card[0]) : (card[0] || card[1]);
        const matches = (text) => text.toLowerCase().includes(keyword);

        const poolMap = {
            abilities: ['abilities', cardPools.pool],
            races: ['races', cardPools.racePool],
            weapons: ['weapons', cardPools.WeapenPool],
            talents: ['talents', cardPools.TalentPool],
            places: ['places', cardPools.PlacePool],
            events: ['events', cardPools.EventPool],
            summons: ['summons', cardPools.SummonPool],
        };

        for (const [, [key, pool]] of Object.entries(poolMap)) {
            const found = pool.filter(card => matches(getCard(card))).map(getCard);
            if (found.length > 0) results[key] = found;
        }
        res.status(200).json(results);
        return;
    }

    // No q param → return pools
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
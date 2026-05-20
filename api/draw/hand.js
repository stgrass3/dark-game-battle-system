const cardPools = {
    pool: [
        ["無下限術式.赫","Cursed Technique: Red"],["無下限術式.蒼","Cursed Technique: Blue"],
        ["反轉術式","Reverse Cursed Technique"],["黑閃","Black Flash"],
        ["時間暫停","Time Stop"],["血輪眼","Sharingan"],
        ["神盾","Divine Shield"],["死靈法術","Necromancy"],
        ["火焰","Fire"],["風","Wind"],["水","Water"],["冰","Ice"],
    ],
    racePool: [["天使","Angel"],["精靈","Elf"],["人類","Human"],["龍族","Dragon"]],
    WeapenPool: [["炎魔刀","Demon Sword"],["法杖","Staff"],["匕首","Dagger"]],
    SummonPool: [["黑洞","Black Hole"],["精靈","Elf"],["波奇塔","Pochita"]],
};

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

function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
    const lang = req.query.lang || 'en';
    res.status(200).json({ hand: drawHand(lang), lang });
}

module.exports = handler;
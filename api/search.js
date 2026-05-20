const cardPools = {
    pool: [
        ["無下限術式.赫","Cursed Technique: Red"],["無下限術式.蒼","Cursed Technique: Blue"],
        ["反轉術式","Reverse Cursed Technique"],["黑閃","Black Flash"],
        ["時間暫停","Time Stop"],["血輪眼","Sharingan"],
        ["神盾","Divine Shield"],["死靈法術","Necromancy"],
        ["火焰","Fire"],["風","Wind"],["水","Water"],["冰","Ice"],
        ["One for All","One for All"],["All for One","All for One"],
        ["波紋","Ripple"],["螺旋丸","Spiral Sphere"],
        ["乙骨優太{里香}","Okkotsu {Rika}"],
    ],
    racePool: [
        ["天使","Angel"],["精靈","Elf"],["機器人","Robot"],
        ["人類","Human"],["吸血鬼","Vampire"],
        ["龍族","Dragon"],["死神","Shinigami"],
        ["賽亞人","Saiyan"],["超人","Superman"],
    ],
    WeapenPool: [
        ["炎魔刀","Demon Sword"],["法杖","Staff"],
        ["匕首","Dagger"],["拳套","Boxing Gloves"],
        ["雙槍","Dual Pistols"],["RPG","RPG"],
        ["盾牌","Shield"],["武士刀","Katana"],
    ],
    SummonPool: [
        ["黑洞","Black Hole"],["精靈","Elf"],
        ["波奇塔","Pochita"],["九喇嘛","Kurama"],
        ["中國龍","Chinese Dragon"],["女朋友","Girlfriend"],
    ],
};

function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const lang = req.query.lang || 'en';
    const q = req.query.q;

    const getCard = (card) => lang === 'en' ? (card[1] || card[0]) : (card[0] || card[1]);
    const matches = (text) => text.toLowerCase().includes((q || '').toLowerCase());
    const getCards = (pool) => pool.map(card => lang === 'en' ? (card[1] || card[0]) : (card[0] || card[1]));

    // Search mode
    if (q) {
        const poolMap = {
            abilities: ['abilities', cardPools.pool],
            races: ['races', cardPools.racePool],
            weapons: ['weapons', cardPools.WeapenPool],
            summons: ['summons', cardPools.SummonPool],
        };
        const results = {};
        for (const [, [key, pool]] of Object.entries(poolMap)) {
            const found = pool.filter(card => matches(getCard(card))).map(getCard);
            if (found.length > 0) results[key] = found;
        }
        res.status(200).json(results);
        return;
    }

    // Pools mode (no q param)
    const pools = {
        abilities: getCards(cardPools.pool),
        races: getCards(cardPools.racePool),
        weapons: getCards(cardPools.WeapenPool),
        summons: getCards(cardPools.SummonPool),
    };
    res.status(200).json(pools);
}

module.exports = handler;
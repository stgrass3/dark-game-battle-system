const cardPools = {
    pool: [
        ["無下限術式.赫","Cursed Technique: Red"],["無下限術式.蒼","Cursed Technique: Blue"],
        ["反轉術式","Reverse Cursed Technique"],["黑閃","Black Flash"],
        ["死亡回歸","Death Loop"],["火焰","Fire"],
        ["風","Wind"],["水","Water"],["冰","Ice"],
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

function generateId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

function handler(req, res) {
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

    const playerId = generateId();
    const hand = drawHand(lang);

    res.status(200).json({
        roomCode,
        playerId,
        hand,
        phase: 'ready',
        partyUrl: `wss://dark-game-battle.stgrass3.partykit.dev/room/${roomCode}`,
    });
}

module.exports = handler;
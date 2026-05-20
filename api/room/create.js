// Inline data — no imports needed, no module resolution issues
const cardPools = {
    pool: [
        ["無下限術式.赫","Cursed Technique: Red"],["無下限術式.蒼","Cursed Technique: Blue"],
        ["反轉術式","Reverse Cursed Technique"],["黑閃","Black Flash"],
        ["十畫咒法","Ten Shadows Technique"],["詛咒惡魔","Curse Devil"],
        ["石化惡魔","Petrification Devil"],["狐狸惡魔","Fox Devil"],
        ["十種影法術","Ten Shadow Magic"],["熔岩","Lava"],
        ["黑繩","Divine Void Chain"],["時間暫停","Time Stop"],
        ["血輪眼","Sharingan"],["吸血","Blood Drain"],
        ["植物","Plant"],["神盾","Divine Shield"],
        ["死靈法術","Necromancy"],["火焰","Fire"],
        ["風","Wind"],["水","Water"],["冰","Ice"],
        ["One for All","One for All"],["All for One","All for One"],
        ["咒靈操術","Curse Manipulation"],["全反擊","Full Counter"],
        ["波紋","Ripple"],["螺旋丸","Spiral Sphere"],["神威","Kamui"],
        ["幻術","Illusion"],["始解","Shikai"],["卍解","Bankai"],
        ["元氣彈","Spirit Bomb"],["龜派氣功","Kamehameha"],
        ["毒","Poison"],["瞬步","Flash Step"],
        ["惡魔果實","Devil Fruit"],["天使","Angel"],
        ["龍族","Dragon"],["賽亞人","Saiyan"],["超人","Superman"],
        ["死靈","Necromancy"],["複製","Copy"],["爆炸","Explosion"],
        ["鏡花水月","Katen Kyokotsu"],
        ["乙骨優太{里香}","Okkotsu {Rika}"],
    ],
    racePool: [
        ["天使","Angel"],["精靈","Elf"],["機器人","Robot"],
        ["人類","Human"],["吸血鬼","Vampire"],
        ["龍族","Dragon"],["死神","Shinigami"],
        ["賽亞人","Saiyan"],["超人","Superman"],["強化人","Cyborg"],
        ["五條家","Gojo Clan"],["禪院家","Zenin Clan"],
    ],
    WeapenPool: [
        ["炎魔刀","Demon Sword"],["時空刃","Time-Space Blade"],
        ["勝利誓約之劍","Excalibur"],["法杖","Staff"],
        ["匕首","Dagger"],["拳套","Boxing Gloves"],
        ["雙槍","Dual Pistols"],["RPG","RPG"],
        ["斬魄刀","Zanpakuto"],["盾牌","Shield"],
        ["武士刀","Katana"],["弓","Bow"],
    ],
    TalentPool: [
        ["自殘","Self-Harm"],["呼吸法","Breathing"],
        ["黑閃","Black Flash"],["元素抵抗","Element Resistance"],
        ["心靈感應","Telepathy"],["仙人體","Sage Body"],
        ["霸王色霸氣","Haki of the Supreme"],
    ],
    PlacePool: [
        ["平地","Plains"],["山地","Mountains"],
        ["火山","Volcano"],["城市","City"],
        ["海洋","Ocean"],["空島","Sky Island"],
    ],
    EventPool: [
        ["隕石來襲","Meteor Strike"],["火山爆發","Volcanic Eruption"],
        ["下雨","Rain"],["商人","Merchant"],
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

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const { playerName, lang = 'en' } = req.body || {};

    if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
        res.status(400).json({ error: 'playerName required' });
        return;
    }

    const roomCode = generateRoomCode();
    const playerId = generateId();
    const hand = drawHand(lang);

    res.status(200).json({
        roomCode,
        playerId,
        hand,
        phase: 'lobby',
        partyUrl: `wss://dark-game-battle.stgrass3.partykit.dev/room/${roomCode}`,
    });
}
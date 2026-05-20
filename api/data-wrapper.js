const cardPools = require('./data.cjs');
const { drawHand } = cardPools;

// re-export cleanly
module.exports = { drawHand };
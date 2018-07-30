const config = require('../config');


let bnum = config.blockchain.blockStart;
function addBnum() { 
    bnum = bnum + 1;
}

// set to 10 seconds
var timer = setInterval(addBnum, config.blockchain.blockInterval);

module.exports = { 

    getBlockNum: () => {
        return bnum;
    }
}
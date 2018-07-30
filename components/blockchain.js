

let bnum = 0;
function addBnum() { 
    bnum = bnum + 1;
}

// set to 10 seconds
var timer = setInterval(addBnum, 10000);

module.exports = { 

    getBlockNum: () => {
        return bnum;
    }
}
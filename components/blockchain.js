/**
 This file is part of testrpc.
  Copyright (c) 2018 - present Zilliqa Research Pvt. Ltd.
  
  testrpc is free software: you can redistribute it and/or modify it under the
  terms of the GNU General Public License as published by the Free Software
  Foundation, either version 3 of the License, or (at your option) any later
  version.
 
  testrpc is distributed in the hope that it will be useful, but WITHOUT ANY
  WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
  A PARTICULAR PURPOSE.  See the GNU General Public License for more details.
 
  You should have received a copy of the GNU General Public License along with
  testrpc.  If not, see <http://www.gnu.org/licenses/>.
**/

const config = require('../config');

let bnum = config.blockchain.blockStart;
function addBnum() { 
    bnum = bnum + 1;
}

// blockinterval is duration for each block number increment
var timer = setInterval(addBnum, config.blockchain.blockInterval);

module.exports = { 

    getBlockNum: () => {
        return bnum;
    }
}
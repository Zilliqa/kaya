/**
 This file is part of Kaya.
  Copyright (c) 2018 - present Zilliqa Research Pvt. Ltd.
  
  Kaya is free software: you can redistribute it and/or modify it under the
  terms of the GNU General Public License as published by the Free Software
  Foundation, either version 3 of the License, or (at your option) any later
  version.
 
  Kaya is distributed in the hope that it will be useful, but WITHOUT ANY
  WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
  A PARTICULAR PURPOSE.  See the GNU General Public License for more details.
 
  You should have received a copy of the GNU General Public License along with
  Kaya.  If not, see <http://www.gnu.org/licenses/>.
**/

/* Configuration file */
/* Feel free to add more things to this file that will help you in development */


const config = module.exports = {}


config.port = 4200;
config.version = "0.0.1";

// blockchain specific configuration
config.blockchain = {
    // sets timer for the block confirmation
    blockInterval: 10000,    // 10000 = 10 seconds for one block
    blockStart: 0
}

config.wallet = {
    numAccounts: 10,    // number of default accounts
    defaultAmt: 100000,  // default amount of zils assigned to each wallet
    defaultNonce: 0
}

config.scilla = {
    runner_path: './components/scilla/scilla-runner'
}

config.testconfigs = {
    gasPrice: 1,
    gasLimit: 10,
    transferAmt: 100
}
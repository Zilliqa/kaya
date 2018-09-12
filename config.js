/*
 This file is part of kaya.
  Copyright (c) 2018 - present Zilliqa Research Pvt. Ltd.

  kaya is free software: you can redistribute it and/or modify it under the
  terms of the GNU General Public License as published by the Free Software
  Foundation, either version 3 of the License, or (at your option) any later
  version.

  kaya is distributed in the hope that it will be useful, but WITHOUT ANY
  WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
  A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

  You should have received a copy of the GNU General Public License along with
  kaya.  If not, see <http://www.gnu.org/licenses/>.
*/

/* Configuration file */
/* Feel free to add more things to this file that will help you in development */

const config = module.exports

config.port = 4200
config.version = '0.0.1'

// blockchain specific configuration
config.blockchain = {
  // sets timer for the block confirmation
  blockInterval: 10000, // 10000 = 10 seconds for one block
  blockStart: 0,
  gasPrice: 1 // ratio of gas to zil (dummy value of 1:1)
}

config.wallet = {
  numAccounts: 10, // number of default accounts
  defaultAmt: 100000, // default amount of zils assigned to each wallet
  defaultNonce: 0,
}

config.scilla = {
  runner_path: './components/scilla/scilla-runner',
  mode: 'local', // may include remote mode next time
}

config.testconfigs = {
  gasPrice: 1,
  gasLimit: 10,
  transferAmt: 100,
}

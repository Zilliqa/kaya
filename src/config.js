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

const packagejs = require('../package.json');
const { BN } = require('@zilliqa-js/util');


module.exports = {
  port: 4200,
  version: packagejs.version,
  dataPath: '../data/',
  savedFilesDir : '../saved/',

  // blockchain specific configuration
  blockchain: {
    // sets timer for the block confirmation
    blockInterval: 10000, // 10000 : 10 seconds for one block
    blockStart: 0,
    minimumGasPrice: new BN("1000000000"),
    transferGasCost: 1 // Amount of gas consumed for each transfer
  },

  wallet: {
    numAccounts: 10, // number of default accounts
    defaultAmt: new BN("1000000000000000000"), // default amount of zils assigned to each wallet
    defaultNonce: 0,
  },

  // Relevant constants config copied from core zilliqa repo (constants.xml)
  constants: {
    gas: {
      CONTRACT_CREATE_GAS: 500,
      CONTRACT_INVOKE_GAS: 100,
      NORMAL_TRAN_GAS: 10
    },
    smart_contract: {
      SCILLA_BINARY: "./src/components/scilla/scilla-runner",
      SCILLA_LIB: "./src/components/scilla/stdlib"
    }
  },

  /*
Settings for the scilla interpreter
- runner-path: Relative path to your scilla-runner
- remote: Use the remote scilla interpreter. (Default: True). False: Use local scilla interpreter
- url: URL to the remote scilla interpreter
*/
  scilla: {
    remote: false,
    url: "https://scilla-runner.zilliqa.com/contract/call",
  },

  testconfigs: {
    gasPrice: "1_000_000_000",
    gasLimit: 10,
    transferAmt: 100,
    args: {
      r: true,
      remote: true,
      s: null,
      save: null,
      v: true,
      verbose: true,
      version: false,
      f: 'test/account-fixtures.json',
      fixtures: 'test/account-fixtures.json',
      p: 4200,
      port: 4200,
      d: 'data/',
      data: 'data/',
      n: 10,
      numAccounts: 10,
      l: null,
      load: null,
      '$0': 'server.js' }
  },
};

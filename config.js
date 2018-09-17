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

module.exports = {
  port: 4200,
  version: "0.2.0",

  // blockchain specific configuration
  blockchain: {
    // sets timer for the block confirmation
    blockInterval: 10000, // 10000 : 10 seconds for one block
    blockStart: 0,
    gasPrice: 1, // ratio of gas to zil (dummy value of 1:1)
  },

  wallet: {
    numAccounts: 10, // number of default accounts
    defaultAmt: 100000, // default amount of zils assigned to each wallet
    defaultNonce: 0,
  },

  /*
Settings for the scilla interpreter
- runner-path: Relative path to your scilla-runner
- remote: Use the remote scilla interpreter. (Default: True). False: Use local scilla interpreter
- url: URL to the remote scilla interpreter
*/
  scilla: {
    runnerPath: "./components/scilla/scilla-runner",
    localLibDir: "./components/scilla/stdlib",
    remote: true,
    url: "https://scilla-runner.zilliqa.com/contract/call",
  },

  testconfigs: {
    gasPrice: 1,
    gasLimit: 10,
    transferAmt: 100,
  },
};

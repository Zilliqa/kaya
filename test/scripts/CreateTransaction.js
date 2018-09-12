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

require('isomorphic-fetch');
const BN = require('bn.js');
const { Zilliqa } = require('zilliqa-js');

const url = 'http://localhost:4200';
const { argv } = require('yargs');

const zilliqa = new Zilliqa({
  nodeUrl: url,
});

let privateKey;
// User supplies the private key through `--key`
if (argv.key) {
  privateKey = argv.key;
  console.log(`Your Private Key: ${privateKey} \n`);
} else {
  console.log('No private key given! Generating random privatekey.'.green);
  privateKey = zilliqa.util.generatePrivateKey();
  console.info(`Your Private Key: ${privateKey.toString('hex')}`);
}

if (!argv.to) {
  console.log('To address required');
  process.exit(0);
}

const address = zilliqa.util.getAddressFromPrivateKey(privateKey);

const node = zilliqa.getNode();
console.log(`Address: ${address}`);

function callback(err, data) {
  if (err || data.error) {
    console.log(err);
  } else {
    console.log(data);
  }
}

/*  MAIN LOGIC  */

console.log('Zilliqa Testing Script'.bold.cyan);
console.log(`Connected to ${url}`);

/* Contract specific Parameters */

// the immutable initialisation variables
const msg = {
  _tag: 'setHello',
  _amount: '0',
  _sender: '0x7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8',
  params: [
    {
      vname: 'msg',
      type: 'String',
      value: 'Morning',
    },
  ],
};

// transaction details
const txnDetails = {
  version: 0,
  nonce: 2,
  to: argv.to,
  amount: new BN(0),
  gasPrice: 0,
  gasLimit: 100,
  data: JSON.stringify(msg).replace(/\\"/g, '"'),
};

// sign the transaction using util methods
const txn = zilliqa.util.createTransactionJson(privateKey, txnDetails);
console.log(txn);

// send the transaction to the node
node.createTransaction(txn, callback);

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
const { Zilliqa } = require('zilliqa-js');
const fs = require('fs');
const { argv } = require('yargs');
const BN = require('bn.js');

const url = 'http://localhost:4200';
const zilliqa = new Zilliqa({
  nodeUrl: url,
});

let privateKey;

if (argv.test) {
  privateKey = 'db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3';
} else {
  // User supplies the private key through `--key`
  if (argv.key) {
    privateKey = argv.key;
    console.log(`Your Private Key: ${privateKey} \n`);
  } else {
    console.log('No private key given! Generating random privatekey.');
    privateKey = zilliqa.util.generatePrivateKey();
    console.info(`Your Private Key: ${privateKey.toString('hex')}`);
  }
}

const address = zilliqa.util.getAddressFromPrivateKey(privateKey);
const node = zilliqa.getNode();

console.log(`Address: ${address}`);
console.log(`Pubkey:  ${zilliqa.util.getPubKeyFromPrivateKey(privateKey)}`);

function callback(err, data) {
  if (err || data.error) {
    console.log(err);
  } else {
    console.log(data);
  }
}

/*
     MAIN LOGIC
*/
console.log('Zilliqa Testing Script');
console.log(`Connected to ${url}`);

/* Contract specific Parameters */

const codeStr = fs.readFileSync('contract.scilla', 'utf-8');
// the immutable initialisation variables
const initParams = [
  {
    vname: 'owner',
    type: 'ByStr20',
    value: '0x7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8',
  },
  {
    vname: '_creation_block',
    type: 'BNum',
    value: '100',
  },
];

// transaction details
const txnDetails = {
  version: 0,
  nonce: 1,
  to: '0000000000000000000000000000000000000000',
  amount: new BN(0),
  gasPrice: 1,
  gasLimit: 2000,
  code: codeStr,
  data: JSON.stringify(initParams).replace(/\\' /g, '"'),
};

console.log(initParams);
// sign the transaction using util methods
const txn = zilliqa.util.createTransactionJson(privateKey, txnDetails);

// // send the transaction to the node
node.createTransaction(txn, callback);

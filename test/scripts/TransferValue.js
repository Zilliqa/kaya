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
const { argv } = require('yargs');

const url = 'http://localhost:4200';

const zilliqa = new Zilliqa({
  nodeUrl: url
});

/*
  usage: node TransferToken.js --from [private_key] --to [wallet_address]
*/
if (argv.help) {
  console.log(`Usage: node TransferValue --from [private_key] --to
  [address] --amt [0] --nonce [0]`);
  process.exit(0);
}


// User supplies the private key through `--key`
if (!argv.from) {
  console.log('Private key must be given');
  process.exit(1);
}

if (!argv.to) {
  console.log('Recipient wallet address required');
  process.exit(0);
}

const recipientAddress = argv.to;
const privateKey = argv.from;
const senderAddress = zilliqa.util.getAddressFromPrivateKey(privateKey);
let currNonce = 0;
let amount = 100;

if (argv.amt && !Number.isNaN(argv.amt)) {
  if (argv.amt < 0) {
    console.log('Amount cannot be negative');
    process.exit(1);
  }
  amount = Number(argv.amt);
}
if (argv.nonce && !Number.isNaN(argv.nonce)) {
  if (argv.nonce < 0) {
    console.log('Nonce cannot be negative');
    process.exit(1);
  }
  currNonce = Number(argv.nonce);
}

const node = zilliqa.getNode();
console.log(`From:  ${senderAddress}`);
console.log(`Recipient: ${recipientAddress}`);

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

// transaction details - update the nonce yourself.
const txnDetails = {
  version: 0,
  nonce: currNonce,
  to: argv.to,
  amount: new BN(amount),
  gasPrice: 1,
  gasLimit: 10,
};

// sign the transaction using util methods
const txn = zilliqa.util.createTransactionJson(privateKey, txnDetails);
console.log(txn);

// send the transaction to the node
node.createTransaction(txn, callback);

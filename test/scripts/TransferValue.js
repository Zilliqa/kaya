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
const node = zilliqa.getNode();

const getNonceAsync = addr => {
  return new Promise((resolve, reject) => {
    zilliqa.node.getBalance({ address: addr }, (err, data) => {
      if (err || data.error) {
        reject(err);
      } else {
        resolve(data.result.nonce);
      }
    });
  });
};

/*
  usage: node TransferToken.js --from [private_key] --to [wallet_address]
*/
if (argv.help) {
  console.log(`Usage: node TransferValue --key [private_key] --to
  [address] --amt [0]`);
  process.exit(0);
}

let privateKey, recipientAddress, amount;
if (argv.test) {
  // Use test values
  privateKey = 'db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3';
  recipientAddress = 'd90f2e538ce0df89c8273cad3b63ec44a3c4ed82';
  amount = 100;
} else {

  // User supplies the private key through `--key`
  if (!argv.key) {
    console.log('Private key must be given');
    process.exit(1);
  }

  if (!argv.to) {
    console.log('Recipient wallet address required');
    process.exit(1);
  }

  if (argv.amt && !Number.isNaN(argv.amt)) {
    if (argv.amt < 0) {
      console.log('Amount cannot be negative');
      process.exit(1);
    }
    amount = Number(argv.amt);
  } else {
    console.log('Invalid amount');
    process.exit(1);
  }

  recipientAddress = argv.to;
  privateKey = argv.key;
}
const senderAddress = zilliqa.util.getAddressFromPrivateKey(privateKey);

getNonceAsync(senderAddress)
  .then(nonceVal => {
    console.log('Zilliqa Testing Script');
    console.log(`Connected to ${url}`);

    let currNonce = nonceVal + 1;
    console.log(`From:  ${senderAddress}`);
    console.log(`Recipient: ${recipientAddress}`);

    // transaction details - update the nonce yourself.
    const txnDetails = {
      version: 0,
      nonce: currNonce,
      to: recipientAddress,
      amount: new BN(amount),
      gasPrice: 1,
      gasLimit: 10
    };

    // sign the transaction using util methods
    const txn = zilliqa.util.createTransactionJson(privateKey, txnDetails);
    console.log(txn);

    // send the transaction to the node
    node.createTransaction(txn, callback);



  })




function callback(err, data) {
  if (err || data.error) {
    console.log(err);
  } else {
    console.log(data);
  }
}





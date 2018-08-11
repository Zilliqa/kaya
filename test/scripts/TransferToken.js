/**
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
**/

let { Zilliqa } = require('zilliqa-js');
let url = 'http://localhost:4200'
let fs = require('fs');
let argv = require('yargs').argv;
let colors = require('colors');

let zilliqa = new Zilliqa({
    nodeUrl: url
})


/*
    usage: node TransferToken.js --from [private_key] --to [wallet_address]
*/ 

// User supplies the private key through `--key`
if (!argv.from) {
    console.log('Private key must be given');
    exit(0);
}

if (!argv.to) { 
    console.log('Recipient wallet address required');
    process.exit(0);
}

let recipient_address = argv.to;
let privateKey = argv.from;
let sender_address = zilliqa.util.getAddressFromPrivateKey(privateKey);

let node = zilliqa.getNode();
console.log(`From:  ${sender_address}`);
console.log(`Recipient: ${recipient_address}`);

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
console.log('Zilliqa Testing Script'.bold.cyan);
console.log(`Connected to ${url}`);

// transaction details - update the nonce yourself.
let txnDetails = {
    version: 0,
    nonce: 1,
    to: argv.to ,
    amount: 990,
    gasPrice: 1,
    gasLimit: 10
};
``
// sign the transaction using util methods
let txn = zilliqa.util.createTransactionJson(privateKey, txnDetails);
console.log(txn);

// send the transaction to the node
node.createTransaction(txn, callback);



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


let { Zilliqa } = require('zilliqa-js');
let fs = require('fs');
let argv = require('yargs').argv;
let colors = require('colors');
let url = 'http://localhost:4200'
let zilliqa = new Zilliqa({
    nodeUrl: 'http://localhost:4200'
})

let privateKey, address;

// User supplies the private key through `--key`
if (argv.key) {
    privateKey = argv.key;
    console.log(`Your Private Key: ${privateKey} \n`);
} else {
    console.log('No private key given! Generating random privatekey.'.green);
    privateKey = zilliqa.util.generatePrivateKey();
    console.info(`Your Private Key: ${privateKey.toString('hex')}`);
}

address = zilliqa.util.getAddressFromPrivateKey(privateKey);

/*
if (argv.config) {
    // Read all options from config file
    console.log('Reading wallet information from Config file.')
    privateKey = config.test_private_key;
    address = config.test_address;
}
*/

let node = zilliqa.getNode();
console.log(`Address: ${address}`);

function callback(err, data) {
    if (err || data.error) {
        console.log('Error');
    } else {
        console.log(data);
    }
}


/*
        MAIN LOGIC
*/
console.log('Zilliqa Testing Script'.bold.cyan);
console.log(`Connected to ${url}`);

/* Contract specific Parameters */

var code = fs.readFileSync('contract.scilla', 'utf-8');
// the immutable initialisation variables
let initParams = [
    {
        "vname" : "owner",
        "type" : "Address", 
        "value" : "0x1234567890123456789012345678901234567890",
    },
    {
        "vname" : "_creation_block",
        "type": "BNum",
        "value": "100"
    }
];

// transaction details
let txnDetails = {
    version: 0,
    nonce: 1,
    to: '0000000000000000000000000000000000000000',
    amount: 0,
    gasPrice: 1,
    gasLimit: 50,
    code: code,
    data: JSON.stringify(initParams).replace(/\\"/g, '"')
};

console.log(initParams);
// sign the transaction using util methods
let txn = zilliqa.util.createTransactionJson(privateKey, txnDetails);

// // send the transaction to the node
node.createTransaction(txn, callback);

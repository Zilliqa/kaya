/**
* Copyright (c) 2018 Zilliqa 
* This source code is being disclosed to you solely for the purpose of your participation in 
* testing Zilliqa. You may view, compile and run the code for that purpose and pursuant to 
* the protocols and algorithms that are programmed into, and intended by, the code. You may 
* not do anything else with the code without express permission from Zilliqa Research Pte. Ltd., 
* including modifying or publishing the code (or any part of it), and developing or forming 
* another public or private blockchain network. This source code is provided ‘as is’ and no 
* warranties are given as to title or non-infringement, merchantability or fitness for purpose 
* and, to the extent permitted by law, all liability for your use of the code is disclaimed. 
* Some programs in this code are governed by the GNU General Public License v3.0 (available at 
* https://www.gnu.org/licenses/gpl-3.0.en.html) (‘GPLv3’). The programs that are governed by 
* GPLv3.0 are those programs that are located in the folders src/depends and tests/depends 
* and which include a reference to GPLv3 in their program files.
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

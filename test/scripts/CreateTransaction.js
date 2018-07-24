let { Zilliqa } = require('zilliqa.js');
let config = require('./config')
let url = config.test_scilla_explorer ? config.url_remotehost : config.url_localhost;
let fs = require('fs');
let argv = require('yargs').argv;
let colors = require('colors');

let zilliqa = new Zilliqa({
    nodeUrl: url
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

if (argv.config) {
    // Read all options from config file
    console.log('Reading wallet information from Config file.')
    privateKey = config.test_private_key;
    address = config.test_address;
}


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

var code = fs.readFileSync('NFT.scilla', 'utf-8');
// the immutable initialisation variables
let msg = {
    "_tag": "totalSupply",
    "_amount": "0",
    "_sender" : "0x1234567890123456789012345678901234567890",
    "params": [
   ]
};

// transaction details
let txnDetails = {
    version: 0,
    nonce: 6,
    to: 'cc0a63c8a50df57780059a6d2ea36ebfda64f434',
    amount: 0,
    gasPrice: 1,
    gasLimit: 50,
    code: code,
    data: JSON.stringify(msg).replace(/\\"/g, '"')
};

console.log(msg);
// sign the transaction using util methods
let txn = zilliqa.util.createTransactionJson(privateKey, txnDetails);

// // send the transaction to the node
node.createTransaction(txn, callback);



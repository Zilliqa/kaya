let { Zilliqa } = require('zilliqa.js');
let config = require('./config')
let url = config.test_scilla_explorer ? config.url_remotehost : config.url_localhost;
let fs = require('fs');
let argv = require('yargs').argv;
let colors = require('colors');

let zilliqa = new Zilliqa({
    nodeUrl: url
})

console.log('Zilliqa Testing Script'.bold.cyan);
// Parse Command-Line options

if(argv.howtouse) { 
    console.log(`Supported methods: deploy, createtxn, networkid,getcontracts, getstate`)
    return;
}

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

/* Method handling: */
if (argv.method) {
    console.log(`Method specified: ${argv.method}`);
    switch (argv.method) {
        case 'deploy':
            deployContract();
            break;
        case 'createtxn':
            sendTransaction();
            break;
        case 'networkid':
            getNetworkId();
            break;
        case 'getsmartcontracts':
            getSmartContracts();
            break;
        case 'getstate':
            getState();
            break;
        case 'gettxn':
            getTransaction();
            break;
        default:
            console.log('No matching methods found'.red);
    }
} else {
    console.log('Error: No Method Specified'.red + 'You have to specify a method.');
    console.log('Supported Methods: `deploy`, `txn`, `networkid`? ');
}

function getState() { 
    node.getSmartContractState({ address: 'dac620855671af9dd39fc62c4631d97280ccbf29' }, function(err, data) {
        if (err || (data.result && data.result.Error)) {
            console.log(err)
        } else {
            console.log(data)
        }
    })
}


function getSmartContracts() {

    node.getSmartContracts({ address: 'dac620855671af9dd39fc62c4631d97280ccbf29' }, function (err, data) {
        if (err || data.error) {
            console.log(err)
        } else {
            console.log(data.result)
        }
    })
}

// Simulates deployment behaviour
function deployContract() {

    var code = fs.readFileSync('code.scilla', 'utf-8');
    // the immutable initialisation variables
    let initParams = [
        {
            "vname": "owner",
            "type": "Address",
            "value": `0x${address}`
        },
        {
            "vname": "_creation_block",
            "type": "BNum",
            "value": "100"
        }
    ];

    // transaction details
    let txnDetails = {
        version: 0,
        nonce: 0,
        to: '0000000000000000000000000000000000000000',
        amount: 0,
        gasPrice: 1,
        gasLimit: 50,
        code: code,
        data: JSON.stringify(initParams).replace(/\\"/g, '"')
    };

    // sign the transaction using util methods
    let txn = zilliqa.util.createTransactionJson(privateKey, txnDetails);

    // // send the transaction to the node
    node.createTransaction(txn, callback);
}

function sendTransaction() {
    // test function. Only works for single inputs
    contractAddr = argv.c_addr;
    method_specified = argv.c_method;
    value = argv.c_val;

    console.log(`Calling Existing Contract (${contractAddr})`);
    console.log(`Method: ${method_specified} , value: ${value}`)

    msg = {
        "_tag": `${method_specified}`,
        "_amount": "0",
        "_sender": `0x${address}`,
        "params": [
            {
                "vname": "msg",
                "type": "String",
                "value": `${value}`
            }
        ]
    };
    // transaction details
    let txnDetails = {
        version: 0,
        nonce: 1,
        to: contractAddr,
        amount: 0,
        gasPrice: 1,
        gasLimit: 10,
        data: JSON.stringify(msg).replace(/\\"/g, '"')
    };

    // sign the transaction using util methods
    let txn = zilliqa.util.createTransactionJson(privateKey, txnDetails);

    // // send the transaction to the node
    node.createTransaction(txn, callback);
}

function getTransaction() {
    var txnId;
    if (argv.tid) {
        txnId = argv.tid;
    } else {
        throw new Error('TransactionID (--tid) must be provided')
    }

    zilliqa.node.getTransaction({ txHash: txnId }, callback);

}

function getNetworkId() {

    zilliqa.node.getNetworkId(function (err, data) {
        if (err || !data.result) {
            console.log(err)
        } else {
            console.log(data)
        }
    })
}







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



const express = require('express');
const bodyParser = require('body-parser');
const debug_server = require('debug')('testrpc:server');
const port = 4200;
const app = express();
const logic = require('./logic');
const wallet = require('./components/wallet/wallet');
const fs = require('fs');
const fsp = require('node-fs');
let argv = require('yargs').argv;
var rimraf = require('rimraf');
const utilities = require('./utilities');
app.use(bodyParser.json({ extended: false }));

var isPersistence = false; // tmp is the default behavior
function makeResponse(id, jsonrpc, data, isErr) {
    var responseObj = {};
    responseObj['id'] = id;
    responseObj['jsonrpc'] = jsonrpc;
    if (isErr) {
        responseObj['Error'] = data;
    } else {
        responseObj['result'] = data;
    }
    return responseObj;
}


app.post('/', (req, res) => {
    let body = req.body;
    let data = {};
    console.log(`Method specified: ${body.method}`);
    switch (body.method) {
        case 'GetBalance':
            console.log(`Getting balance for ${body.params}`);
            try {
                data = wallet.getBalance(body.params);
            } catch (err) {
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
            break;
        case 'GetNetworkId':
            data = makeResponse(body.id, body.jsonrpc, 'Testnet', false);
            res.status(200).send(data);
            break;
        case 'GetSmartContractCode':
            var result;
            try {
                result = logic.processGetSmartContractCode(body.params, isPersistence);
                data = result;
            } catch (err) {
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
            break;
        case 'GetSmartContractState':
            var result;
            try {
                result = logic.processGetSmartContractState(body.params, isPersistence);
                data = result;
            } catch (err) {
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
            break;
        case 'GetSmartContractInit':
            try {
                result = logic.processGetSmartContractInit(body.params, isPersistence);
                data = result;
            } catch (err) {
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
            break;;
        case 'GetSmartContracts':
            try {
                result = logic.processGetSmartContracts(body.params, argv.save);
                data = result;
            } catch (err) {
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
            break;
        case 'CreateTransaction':
            try {
                let txn_id = logic.processCreateTxn(body.params, argv.save);
                data = { result: txn_id };
            } catch (err) {
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
            break;
        case 'GetTransaction':
            try {
                var obj = logic.processGetTransaction(body.params);
                data = obj
            } catch (err) {
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
            break;
        case 'GetRecentTransactions':
            var obj = {};
            try {
                obj = logic.processGetRecentTransactions(body.params);
                data = obj;
            } catch (err) {
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
            break;
        default:
            data = { "error": "Unsupported Method" };
            res.status(404).send(data);
    }
    console.log('Sending status');

})

// Signal handling
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

const server = app.listen(port, (err) => {
    console.log(`Zilliqa TestRPC Server (ver: 0.0.1)\n`.cyan);

    if (argv.save) {
        console.log('Save mode enabled');
        isPersistence = true;
    }

    if (argv.load) {
        // loading option specified
        console.log('Loading option specified.');
        logic.bootstrapFile(argv.load);
        isPersistence = true;
    }

    // cleanup old folders
    if (fs.existsSync('./tmp')) {
        debug_server(`Tmp folder found. Removing ${__dirname}/tmp`);
        rimraf.sync(__dirname + '/tmp');
        debug_server(`${__dirname}/tmp removed`);
    }


    if (!fs.existsSync('./tmp')) {
        fs.mkdirSync('./tmp');
        debug_server(`tmp folder created in ${__dirname}/tmp`);
    }
    if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data');
        fsp.mkdir('./data/save', 0777, true, function (err) {
            if (err) {
                console.log(err);
            } else {
                debug_server('Directory created');
            }
        });
    }

    /* Create Dummy Accounts */
    wallet.createWallets(10); // create 10 wallets by default
    wallet.printWallet();

    console.log(`\nServer listening on 127.0.0.1:${port}`.yellow)
})

// Listener for connections opening on the server
let connections = [];
server.on('connection', connection => {
    connections.push(connection);
    connection.on('close', () => connections = connections.filter(curr => curr !== connection));
});

// Graceful shutdown function. Clear the files
function shutDown() {
    console.info('Kill signal received  shutting down gracefully');

    if (argv.save) {
        logic.dumpDataFiles();
    }

    server.close(() => {
        debug_server('Closed out remaining connections');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);

    connections.forEach(curr => curr.end());
    // For Chrome: Sends destroy commands instead
    setTimeout(() => connections.forEach(curr => curr.destroy()), 5000);
}
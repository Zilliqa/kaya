const express = require('express');
const bodyParser = require('body-parser');
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
    if(isErr) {
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
            // todo: After wallet module is completed.
            data = { result: { balance: 0, nonce: 0 } };
            res.status(200).send(data);
            break;
        case 'GetNetworkId':
            //let networkid = logic.processGetNetworkID(body.params);

            data = makeResponse(body.id, body.jsonrpc, 'Testnet', false);
            res.status(200).send(data);
            break;
        case 'GetSmartContractState':
            var result;
            try {
                result = logic.processGetSmartContractState(body.params, isPersistence);
                data = result;
            } catch (err) {
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data,true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
            break;
        case 'GetSmartContracts':
            try {
                result = logic.processGetSmartContracts(body.params, argv.save);
                data = result;
            } catch(err) {       
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data,true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
            break;
        case 'CreateTransaction':
            let txn_id = logic.processCreateTxn(body.params, argv.save);
            data = { result: txn_id };
            res.status(200).send(data);
            break;
        case 'GetTransaction':
            try {
                var obj = logic.processGetTransaction(body.params);
                data = obj
            }   catch (err) { 
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
            }   catch (err) { 
                data = err.message;
                res.status(200).send(makeResponse(body.id, body.jsonrpc, data,true));
                break;
            }
            res.status(200).send(makeResponse(body.id, body.jsonrpc, data,false));
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
    console.log(`Zilliqa TestRPC Server`.cyan);
    console.log('\n');

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

    if (!fs.existsSync('./tmp')) {
        fs.mkdirSync('./tmp');
    }
    if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data');
        fsp.mkdir('./data/save', 0777, true, function (err) {
            if (err) {
                console.log(err);
            } else {
                console.log('Directory created');
            }
        });
    }

    /* Create new wallets */
    wallet.bootstrap();

    console.log(`Server listening on port ${port}`)
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
    rimraf('./tmp', function () { console.log(`/tmp directory removed`) });

    server.close(() => {
        console.log('Closed out remaining connections');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);

    connections.forEach(curr => curr.end());
    // Handles Chrome's stubborness to shutdown. Sends destroy commands instead
    setTimeout(() => connections.forEach(curr => curr.destroy()), 5000);
}
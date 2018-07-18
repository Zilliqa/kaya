const express = require('express');
const bodyParser = require('body-parser');
const port = 4200;
const app = express();
const logic = require('./logic');
const fs = require('fs');
let argv = require('yargs').argv;
var rimraf = require('rimraf');

const Transaction = require('./models/Transaction')

app.use(bodyParser.json({extended: false}));

app.post('/', (req, res) => {
    let body = req.body;
    console.log(`Method specified: ${body.method}`);
    switch(body.method) {
        case 'GetBalance':
            console.log(`Getting balance for ${body.params}`);
            // todo: After wallet module is completed.
            var data = {result: { balance: 0, nonce: 0 }};
            res.status(200).send(data);
            break;
        case 'GetNetworkId':
            //let networkid = logic.processGetNetworkID(body.params);
            var data = {};
            data['id'] = body.id;
            data['jsonrpc'] = body.jsonrpc;
            data['result'] = 'Testnet';
            res.status(200).send(data);
            break;
        case 'CreateTransaction':
            let txn_id = logic.processCreateTransaction(body.params);
            var data = {result: txn_id};
            res.status(200).send(data);
            break;
        case 'GetTransaction':
            var obj = logic.processGetTransaction(body.params);
            var data = {result: obj};
            console.log(data);
            res.status(200).send(data);
            break;
        default:
            data = {"error": "Unsupported Method"};
            res.status(404).send(data);
    } 
    console.log('Sending status');
    
})

// Signal handling
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

const server = app.listen(port, (err) => {
    console.log(`Zilliqa TestRPC Server`);
    console.log(process.argv[2]);

    if(!fs.existsSync('./tmp')) {
        fs.mkdirSync('./tmp');
    }
    if(!fs.existsSync('./data')) {
        fs.mkdirSync('./data');
    }

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

    if(argv.save) { 
        console.info(`Save mode enabled; data will be stored in /data`.yellow);
        logic.dumpDataFiles();
    }
    rimraf('tmp', function() { console.log(`/tmp directory removed`)});

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
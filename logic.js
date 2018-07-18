// logic.js : Logic Script
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zilliqa_util = require('./lib/util')
const utilities = require('./utilities');

// debug usage: DEBUG=scilla-txn node server.js
var debug_txn = require('debug')('scilla-txn');
var debug_gettxn = require('debug')('scilla-gettxn');



// non-persistent states. Initializes whenever server starts
const repo = {};
const transactions = {}
const map_Caddr_owner = {}

// stores a map of wallet address to contract addresses
const addr_to_contracts = [];

module.exports = {

    processCreateTransaction: (data) => {
        debug_txn('Processing transaction...');

        let payload = data[0];
        if (payload.code && payload.to == '0000000000000000000000000000000000000000') {
            debug_txn('Deploying a contract');

            _sender = zilliqa_util.getAddressFromPublicKey('02DFB1F0B14A1C81EE2D31F43B223FF88207FFCB193F1D01BA38C01DF1DBF0F1FF');
            debug_txn(`Sender: ${_sender}`);

            newTransactionID = crypto.randomBytes(32).toString('hex');
            let txnDetails = {
                version: payload.version,
                nonce: payload.nonce,
                to: payload.to,
                from: _sender,
                amount: payload.amount,
                pubkey: payload.pubKey,
            };
            transactions[newTransactionID] = txnDetails;
            debug_txn('%O', txnDetails)
            // todo: change to a proper address generation design
            let newContract_addr = crypto.randomBytes(20).toString('hex');

            // Cleaning code before parsing to scilla-runner
            rawCode = JSON.stringify(payload.code);
            cleanedCode = utilities.codeCleanup(rawCode);

            let newCode_path = `data/${newContract_addr}_code.scilla`;
            fs.writeFileSync(newCode_path, cleanedCode);

            let initParams = JSON.stringify(payload.data);
            cleaned_params = utilities.paramsCleanup(initParams);
            
            fs.writeFileSync(`data/${newContract_addr}_init.json`, cleaned_params);

            // Run Scilla Interpreter
            const exec = require('child_process').execSync;
            let scilla_cmd = `./scilla/scilla-runner -init data/${newContract_addr}_init.json -i ${newCode_path} -iblockchain template/blockchain.json -o tmp/${newContract_addr}_out.json -imessage test/message.json -istate template/state.json`;
            const child = exec(scilla_cmd,
                (error, stdout, stderr) => {
                    if (error !== null) {
                        console.warn(`exec error: ${error}`);
                    }
                });
            debug_txn('Scilla run completed. Performing state changes now');

            // Extract state from tmp/out.json
            var retMsg = JSON.parse(fs.readFileSync(`tmp/${newContract_addr}_out.json`, 'utf-8'));
            fs.writeFileSync(`data/${newContract_addr}_state.json`, JSON.stringify(retMsg.states));
            debug_txn(`State logged down in ${newContract_addr}_state.json`)

            console.log(`Contract Address Deployed: ${newContract_addr}`);

            // Updating states
            if (!(_sender in addr_to_contracts)) {
                addr_to_contracts[_sender] = [];
            }
            addr_to_contracts[_sender].push(newContract_addr);

            return newTransactionID;

        } else {
            debug_txn('Processing transaction to an exisiting contract');

            let payload = data[0];
            // todo: change transactionID generation to match existing impl
            newTransactionID = crypto.randomBytes(32).toString('hex');
            let txnDetails = {
                version: payload.version,
                nonce: payload.nonce,
                to: payload.to,
                from: _sender,
                amount: payload.amount,
                pubkey: payload.pubKey,
            };
            let contractAddr = payload.to;
            debug_txn(`Contract: ${contractAddr}`);
            transactions[newTransactionID] = txnDetails;
            debug_txn('%O', txnDetails);
            debug_txn('Payload Received %O', payload.data);
            let incomingMessage = JSON.stringify(payload.data);
            cleaned_msg = utilities.paramsCleanup(incomingMessage);
            fs.writeFileSync(`tmp/${payload.to}_message.json`, cleaned_msg);

            // Run Scilla Interpreter
            const exec = require('child_process').execSync;
            let scilla_cmd = `./scilla/scilla-runner -init data/${contractAddr}_init.json -i data/${contractAddr}_code.scilla -iblockchain template/blockchain.json -o tmp/${contractAddr}_out.json -imessage tmp/${payload.to}_message.json -istate data/${contractAddr}_state.json`;
            debug_txn(scilla_cmd);
            const child = exec(scilla_cmd,
                (error, stdout, stderr) => {
                    if (error !== null) {
                        console.warn(`exec error: ${error}`);
                    }
                });
            debug_txn('Scilla run completed. Performing state changes now');

             // Extract state from tmp/out.json
             var retMsg = JSON.parse(fs.readFileSync(`tmp/${contractAddr}_out.json`, 'utf-8'));
             fs.writeFileSync(`data/${contractAddr}_state.json`, JSON.stringify(retMsg.states));
             debug_txn(`State logged down in ${contractAddr}_state.json`);
             console.log('New State'.cyan);
             console.log(retMsg.states);

             return newTransactionID;
        }
    },

    processGetTransaction: (data) => { 
        console.log(transactions);
        console.log(Object.keys(transactions));
        return transactions[data[0]];
    }
}
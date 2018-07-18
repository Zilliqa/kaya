// logic.js : Logic Script
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zilliqa_util = require('./lib/util')
const utilities = require('./utilities');

// debug usage: DEBUG=scilla-txn node server.js
var debug_txn = require('debug')('txn');


// non-persistent states. Initializes whenever server starts
var repo = {};
var transactions = {};
var map_Caddr_owner = {};

function pad(number, length) {
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}

Date.prototype.YYYYMMDDHHMMSS = function () {
    var yyyy = this.getFullYear().toString();
    var MM = pad(this.getMonth() + 1, 2);
    var dd = pad(this.getDate(), 2);
    var hh = pad(this.getHours(), 2);
    var mm = pad(this.getMinutes(), 2)
    var ss = pad(this.getSeconds(), 2)

    return yyyy + MM + dd + hh + mm + ss;
};

// stores a map of wallet address to contract addresses
const addr_to_contracts = [];

module.exports = {

    bootstrapFile: (filepath) => { 
        //bootstraps state of transactions and caddr owner
        var data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        console.log('state of blockchain:');
        transactions =data.transactions;
        repo = data.repo;
        map_Caddr_owner = data.map_Caddr_owner;
        console.log(transactions);
    },

    dumpDataFiles: (data) => {
        // save the state of transactions
        var data = {};
        data.transactions = transactions;
        data.map_Caddr_owner = map_Caddr_owner;
        data.repo = repo;
        var d = new Date();
        save_filename = `data/save/${d.YYYYMMDDHHMMSS()}_blockchain_states.json`;
        console.log(`Save Mode Enabled: Files will be saved in ${save_filename}`);
        fs.writeFileSync(save_filename, JSON.stringify(data,'UTF-8'));
    },

    processCreateTransaction: (data, saveMode) => {
        debug_txn('Processing transaction...');
        dir = 'tmp/'
        if(saveMode) { 
            console.log('Save mode enabled.');
            dir = 'data/'
        }

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

            let newCode_path = `${dir}${newContract_addr}_code.scilla`;
            fs.writeFileSync(newCode_path, cleanedCode);

            let initParams = JSON.stringify(payload.data);
            cleaned_params = utilities.paramsCleanup(initParams);

            fs.writeFileSync(`${dir}${newContract_addr}_init.json`, cleaned_params);

            // Run Scilla Interpreter
            const exec = require('child_process').execSync;
            let scilla_cmd = `./scilla/scilla-runner -init ${dir}${newContract_addr}_init.json -i ${newCode_path} -iblockchain template/blockchain.json -o tmp/${newContract_addr}_out.json -imessage test/message.json -istate template/state.json`;
            const child = exec(scilla_cmd,
                (error, stdout, stderr) => {
                    if (error !== null) {
                        console.warn(`exec error: ${error}`);
                    }
                });
            debug_txn('Scilla run completed. Performing state changes now');

            // Extract state from tmp/out.json
            var retMsg = JSON.parse(fs.readFileSync(`tmp/${newContract_addr}_out.json`, 'utf-8'));
            fs.writeFileSync(`${dir}${newContract_addr}_state.json`, JSON.stringify(retMsg.states));
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
            fs.writeFileSync(`${dir}${payload.to}_message.json`, cleaned_msg);

            // Run Scilla Interpreter
            const exec = require('child_process').execSync;
            let scilla_cmd = `./scilla/scilla-runner -init ${dir}${contractAddr}_init.json -i ${dir}${contractAddr}_code.scilla -iblockchain template/blockchain.json -o tmp/${contractAddr}_out.json -imessage tmp/${payload.to}_message.json -istate ${dir}${contractAddr}_state.json`;
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
            fs.writeFileSync(`${dir}${contractAddr}_state.json`, JSON.stringify(retMsg.states));
            debug_txn(`State logged down in ${contractAddr}_state.json`);
            console.log('New State'.cyan);
            console.log(retMsg.states);

            return newTransactionID;
        }
    },

    processGetTransaction: (data) => {
        debug_txn(`TxnID: ${data[0]}`);
        var data = transactions[data[0]];
        return data;;
    }
}
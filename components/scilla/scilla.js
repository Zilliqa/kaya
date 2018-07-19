// logic.js : Logic Script
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zilliqa_util = require('../../lib/util')
const utilities = require('../../utilities');

// debug usage: DEBUG=scilla-txn node server.js
var debug_txn = require('debug')('testrpc:scilla');


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

    executeScillaRun: (payload, contractAddr, dir) => {

        let code_path = `${dir}${contractAddr}_code.scilla`;
        var msg_path, state_path;
        var init_path = `${dir}${contractAddr}_init.json`;
        // Cleaning code before parsing to scilla-runner
        if (payload.code && payload.to == '0000000000000000000000000000000000000000') {

            debug_txn('Code Deployment');
            rawCode = JSON.stringify(payload.code);
            cleanedCode = utilities.codeCleanup(rawCode);
            fs.writeFileSync(code_path, cleanedCode);

            // initialized with standard message template
            msg_path = 'template/message.json';
            state_path = 'template/state.json';

            // get init data from payload
            let initParams = JSON.stringify(payload.data);
            cleaned_params = utilities.paramsCleanup(initParams);
            fs.writeFileSync(`${dir}${contractAddr}_init.json`, cleaned_params);

        } else {
            debug_txn('Processing Contract Transition');
            // todo: check for contract
            if (!fs.existsSync(code_path) || !fs.existsSync(init_path)) {
                // tocheck what is the expected behavior on jsonrpc
                debug_txn('Error, contract has not been created.')
                throw 'Contract has not been deployed.';
            }

            // get message from payload information
            debug_txn('Payload Received %O', payload.data);
            let incomingMessage = JSON.stringify(payload.data);
            cleaned_msg = utilities.paramsCleanup(incomingMessage);
            fs.writeFileSync(`${dir}${payload.to}_message.json`, cleaned_msg);
            msg_path = `${dir}${payload.to}_message.json`;

        }

        // Run Scilla Interpreter
        const exec = require('child_process').execSync;
        let scilla_cmd = `./components/scilla/scilla-runner -init ${init_path} -i ${code_path} -iblockchain template/blockchain.json -o tmp/${contractAddr}_out.json -imessage ${msg_path} -istate ${state_path}`;
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
        debug_txn(`State logged down in ${contractAddr}_state.json`)

        console.log(`Contract Address Deployed: ${contractAddr}`);

    },

    sendMessage: (payload, contractAddr, dir) => {

    }
}
/**
 This file is part of kaya.
  Copyright (c) 2018 - present Zilliqa Research Pvt. Ltd.
  
  kaya is free software: you can redistribute it and/or modify it under the
  terms of the GNU General Public License as published by the Free Software
  Foundation, either version 3 of the License, or (at your option) any later
  version.
 
  kaya is distributed in the hope that it will be useful, but WITHOUT ANY
  WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
  A PARTICULAR PURPOSE.  See the GNU General Public License for more details.
 
  You should have received a copy of the GNU General Public License along with
  kaya.  If not, see <http://www.gnu.org/licenses/>.
**/

const fs = require('fs');
const path = require('path');
const utilities = require('../../utilities');
let colors = require('colors');

// debug usage: DEBUG=scilla-txn node server.js
const LOG_SCILLA = require('debug')('kaya:scilla');
let blockchain_path = 'tmp/blockchain.json'

const template_state = [
    {
      "vname": "_balance",
      "type" : "Uint128",
      "value": "0"
    }
  ];


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

const makeBlockchainJson = (val) => {
    bc_data = [
        {
            "vname": "BLOCKNUMBER",
            "type": "BNum",
            "value": `${val}`
        }
    ];
    fs.writeFileSync(blockchain_path, JSON.stringify(bc_data));
    LOG_SCILLA(`blockchain.json file prepared for blocknumber: ${val}`);
}

module.exports = {

    executeScillaRun: (payload, contractAddr, dir, currentBnum) => {
         //dump blocknum into a json file
         makeBlockchainJson(currentBnum);

        var msg_path, state_path, code_path, init_path;

        // build code_cmd to be run as an execSync
        var code_cmd = `./components/scilla/scilla-runner -iblockchain ${blockchain_path} -o tmp/${contractAddr}_out.json`;
        // Cleaning code before parsing to scilla-runner
        isCodeDeployment = false;


        if (payload.code && payload.to == '0000000000000000000000000000000000000000') {
            // initialized with standard message template
            isCodeDeployment = true;
            init_path = `${dir}${contractAddr}_init.json`;
            code_path = `${dir}${contractAddr}_code.scilla`;

            LOG_SCILLA('Code Deployment');
            rawCode = JSON.stringify(payload.code);
            cleanedCode = utilities.codeCleanup(rawCode);
            fs.writeFileSync(code_path, cleanedCode);

            code_cmd = `${code_cmd} -init ${init_path} -i ${code_path}`;

            // get init data from payload
            let initParams = JSON.stringify(payload.data);
            cleaned_params = utilities.paramsCleanup(initParams);
            fs.writeFileSync(`${dir}${contractAddr}_init.json`, cleaned_params);

        } else {
            LOG_SCILLA('Processing Contract Transition');
            // todo: check for contract
            contractAddr = payload.to;

            init_path = `${dir}${contractAddr}_init.json`;
            code_path = `${dir}${contractAddr}_code.scilla`;
            state_path = `${dir}${contractAddr}_state.json`;

            code_cmd = `${code_cmd} -init ${init_path} -i ${code_path} -istate ${state_path}`;


            LOG_SCILLA(`Code Path: ${code_path}`);
            LOG_SCILLA(`Init Path: ${init_path}`);
            if (!fs.existsSync(code_path) || !fs.existsSync(init_path)) {
                // tocheck what is the expected behavior on jsonrpc
                LOG_SCILLA('Error, contract has not been created.')
                throw 'Contract has not been deployed.';
            }

            // get message from payload information
            LOG_SCILLA('Payload Received %O', payload.data);
            let incomingMessage = JSON.stringify(payload.data);
            cleaned_msg = utilities.paramsCleanup(incomingMessage);
            fs.writeFileSync(`${dir}${payload.to}_message.json`, cleaned_msg);
            msg_path = `${dir}${payload.to}_message.json`;

            code_cmd = `${code_cmd} -imessage ${msg_path}`

        }
       
        if (!fs.existsSync(code_path) || !fs.existsSync(init_path)) {
            // tocheck what is the expected behavior on jsonrpc
            LOG_SCILLA('Error, contract has not been created.')
            throw 'Contract has not been deployed.';
        }

        // Run Scilla Interpreter
        const exec = require('child_process').execSync;
        const child = exec(code_cmd,
            (error, stdout, stderr) => {
                if (error !== null) {
                    console.warn(`exec error: ${error}`);
                    throw new Error(`Unable to run scilla. Error: ${error}`);
                }
            });
        LOG_SCILLA('Scilla run completed. Performing state changes now');

        // Extract state from tmp/out.json
        var retMsg = JSON.parse(fs.readFileSync(`tmp/${contractAddr}_out.json`, 'utf-8'));
        if(!isCodeDeployment) {
            fs.writeFileSync(`${dir}${contractAddr}_state.json`, JSON.stringify(retMsg.states));
        } else {
            fs.writeFileSync(`${dir}${contractAddr}_state.json`, JSON.stringify(template_state));
        }
        LOG_SCILLA(`State logged down in ${contractAddr}_state.json`)

        console.log(`Contract Address Deployed: ` + `${contractAddr}`.green);
        if(retMsg.message != null) { 
            LOG_SCILLA(`Next address: ${(retMsg.message._recipient)}`);
            return retMsg.message._recipient;
        }
        // hackish solution to be changed
        return '0'.repeat(40);
    }
}
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
const utilities = require('../../utilities');
const config = require('../../config');
const LOG_SCILLA = require('debug')('kaya:scilla');
let blockchain_path = 'tmp/blockchain.json'
let colors = require('colors');

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

const initializeContractState = (amt) => {
    let initState = [
        {
            "vname": "_balance",
            "type": "Uint128",
            "value": amt.toString()
        }
    ]
    return initState;
}


const runLocalInterpreterSync = (command, output_path) => {
    LOG_SCILLA('Running local scilla interpreter (Sync)');
    // Run Scilla Interpreter
    if(!fs.existsSync(config.scilla.runner_path)) {
        LOG_SCILLA('Scilla runner not found. Hint: Have you compiled the scilla binaries?');
        throw new Error('Kaya RPC Runtime Error: Scilla-runner not found');
    }

    const exec = require('child_process').execSync;
    const child = exec(command,
        (error, stdout) => {
            if (error) {
                console.warn(`exec error: ${error}`);
                throw new Error(`Unable to run scilla. Error: ${error}`);
            }
        });
    LOG_SCILLA('Scilla execution completed');

    let retMsg = JSON.parse(fs.readFileSync(output_path, 'utf-8'));
    return retMsg;
}

module.exports = {

    executeScillaRun: (payload, contractAddr, dir, currentBnum) => {

        //dump blocknum into a json file
        makeBlockchainJson(currentBnum);

        let msg_path, state_path, code_path, init_path, cmd;
        let isCodeDeployment = payload.code && payload.to == '0'.repeat(40);
        contractAddr = isCodeDeployment ? contractAddr : payload.to;

        init_path = `${dir}${contractAddr}_init.json`;
        code_path = `${dir}${contractAddr}_code.scilla`;
        output_path = `tmp/${contractAddr}_out.json`;
        state_path = `${dir}${contractAddr}_state.json`;

        cmd = `${config.scilla.runner_path} -iblockchain ${blockchain_path} -o ${output_path} -init ${init_path} -i ${code_path}`;

        if (isCodeDeployment) {

            LOG_SCILLA('Code Deployment');

            // initialized with standard message template
            isCodeDeployment = true;

            // get init data from payload
            let initParams = JSON.stringify(payload.data);
            cleaned_params = utilities.paramsCleanup(initParams);
            fs.writeFileSync(init_path, cleaned_params);

            rawCode = JSON.stringify(payload.code);
            cleanedCode = utilities.codeCleanup(rawCode);
            fs.writeFileSync(code_path, cleanedCode);

        } else {
            
            contractAddr = payload.to;
            LOG_SCILLA(`Calling transition within contract ${payload.to}`);

            LOG_SCILLA(`Code Path: ${code_path}`);
            LOG_SCILLA(`Init Path: ${init_path}`);
            if (!fs.existsSync(code_path) || !fs.existsSync(init_path)) {
                // tocheck what is the expected behavior on jsonrpc
                LOG_SCILLA('Error, contract has not been created.')
                throw new Error('Address does not exist');
            }

            // get message from payload information
            msg_path = `${dir}${payload.to}_message.json`;
            LOG_SCILLA('Payload Received %O', payload.data);
            let incomingMessage = JSON.stringify(payload.data);
            cleaned_msg = utilities.paramsCleanup(incomingMessage);
            fs.writeFileSync(msg_path, cleaned_msg);
            
            // Invoke contract requires additional message and state paths
            cmd = `${cmd} -imessage ${msg_path} -istate ${state_path}`;
        }

        if (!fs.existsSync(code_path) || !fs.existsSync(init_path)|| !fs.existsSync(state_path)) {
            LOG_SCILLA('Error, contract has not been created.')
            throw new Error('Address does not exist');
        }

        let retMsg = runLocalInterpreterSync(cmd); 

        // Extract state from tmp/out.json
        
        let newState = JSON.stringify(retMsg.states);
        if (isCodeDeployment) {
            newState = JSON.stringify(initializeContractState(payload.amount));
        }
        fs.writeFileSync(state_path, newState);
        LOG_SCILLA(`State logged down in ${state_path}`)
        console.log(`Contract Address Deployed: ` + `${contractAddr}`.green);

        if (retMsg.message != null) {
            LOG_SCILLA(`Next address: ${(retMsg.message._recipient)}`);
            return retMsg.message._recipient;
        }
        // Contract deployment runs do not have returned message
        return '0'.repeat(40);
    }
}
/*
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
*/

const fs = require('fs');
const LOG_SCILLA = require('debug')('kaya:scilla');
const { promisify } = require('util');
const rp = require('request-promise');
const { exec } = require('child_process');

const utilities = require('../../utilities');
const config = require('../../config');

const blockchainPath = 'tmp/blockchain.json';

const execAsync = promisify(exec);

const makeBlockchainJson = (val) => {
  const blockchainData = [
    {
      vname: 'BLOCKNUMBER',
      type: 'BNum',
      value: val.toString(),
    },
  ];
  fs.writeFileSync(blockchainPath, JSON.stringify(blockchainData));
  LOG_SCILLA(`blockchain.json file prepared for blocknumber: ${val}`);
};

const initializeContractState = (amt) => {
  const initState = [
    {
      vname: '_balance',
      type: 'Uint128',
      value: amt.toString(),
    },
  ];
  return initState;
};


/*
  Runs the remote interpreter (currently hosted by zilliqa)
  [DEFAULT] - configurable through the config file
  @params: data object containing the code, state, init, message and blockchain filepath
  @returns: Output message received from the remote scilla interpreter
*/
const runRemoteInterpreterAsync = async (data) => {
  LOG_SCILLA('Running Remote Interpreter');

  const reqData = {
    code: fs.readFileSync(data.code, 'utf-8'),
    init: fs.readFileSync(data.init, 'utf-8'),
    blockchain: fs.readFileSync(data.blockchain, 'utf-8'),
    gaslimit: data.gas,
  };

  if (!data.isDeployment) {
    // contract invoke requires state and message
    reqData.state = fs.readFileSync(data.state, 'utf-8');
    reqData.message = data.msg;
  }

  const options = {
    method: 'POST',
    url: config.scilla.url,
    json: true,
    body: reqData,
  };

  let response;
  try {
    response = await rp(options);
  } catch (err) { 
    console.log(`Interpreter failed to process code. Error message received:`);
    console.log(`${err.message}`);
    console.log('Possible fix: Have your code passed type checking?');
    throw new Error('KayaRPC-specific: Interpreter error');
  }
  

  if (!response.message.gas_remaining) {
    console.log('WARNING: You are using an outdated scilla interpreter. Please upgrade to the latest version');
    throw new Error('Outdated scilla binaries');
  }

  return response.message;
};


const runLocalInterpreterAsync = async (command, outputPath) => {
  LOG_SCILLA('Running local scilla interpreter');
  // Run Scilla Interpreter
  if (!fs.existsSync(config.scilla.runnerPath)) {
    LOG_SCILLA(
      'Scilla runner not found. Hint: Have you compiled the scilla binaries?',
    );
    throw new Error('Kaya RPC Runtime Error: Scilla-runner not found');
  }

  const result = await execAsync(command);
  if (result.stderr !== '') {
    throw new Error(`Interpreter error: ${result.stderr}`);
  }

  LOG_SCILLA('Scilla execution completed');

  const retMsg = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  return retMsg;
};

module.exports = {
  executeScillaRun: async (payload, address, dir, currentBnum, gasLimit) => {
    // Get the blocknumber into a json file
    makeBlockchainJson(currentBnum);

    let isCodeDeployment = payload.code && payload.to === '0'.repeat(40);
    const contractAddr = isCodeDeployment ? address : payload.to;

    const initPath = `${dir}${contractAddr}_init.json`;
    const codePath = `${dir}${contractAddr}_code.scilla`;
    const outputPath = `tmp/${contractAddr}_out.json`;
    const statePath = `${dir}${contractAddr}_state.json`;

    let cmd = `${
      config.scilla.runnerPath
    } -iblockchain ${blockchainPath} -o ${outputPath} -init ${initPath} -i ${codePath} -gaslimit ${gasLimit} -libdir ${config.scilla.localLibDir}`;

    if (isCodeDeployment) {
      LOG_SCILLA('Code Deployment');

      // initialized with standard message template
      isCodeDeployment = true;

      // get init data from payload
      const initParams = JSON.stringify(payload.data);
      const cleanedParams = utilities.paramsCleanup(initParams);
      fs.writeFileSync(initPath, cleanedParams);

      const rawCode = JSON.stringify(payload.code);
      const cleanedCode = utilities.codeCleanup(rawCode);
      fs.writeFileSync(codePath, cleanedCode);
    } else {
      LOG_SCILLA(`Calling transition within contract ${payload.to}`);

      LOG_SCILLA(`Code Path: ${codePath}`);
      LOG_SCILLA(`Init Path: ${initPath}`);
      if (!fs.existsSync(codePath) || !fs.existsSync(initPath)) {
        LOG_SCILLA('Error, contract has not been created.');
        throw new Error('Address does not exist');
      }

      // get message from payload information
      const msgPath = `${dir}${payload.to}_message.json`;
      LOG_SCILLA('Payload Received %O', payload.data);
      const incomingMessage = JSON.stringify(payload.data);
      const cleanedMsg = utilities.paramsCleanup(incomingMessage);
      fs.writeFileSync(msgPath, cleanedMsg);

      // Invoke contract requires additional message and state paths
      cmd = `${cmd} -imessage ${msgPath} -istate ${statePath}`;
    }

    if (!fs.existsSync(codePath) || !fs.existsSync(initPath)) {
      LOG_SCILLA('Error, contract has not been created.');
      throw new Error('Address does not exist');
    }

    let retMsg;
    if (!config.scilla.remote) {
      retMsg = await runLocalInterpreterAsync(cmd, outputPath);
    } else {
      const apiReqParams = {
        output: outputPath,
        state: statePath,
        code: codePath,
        msg: payload.data,
        init: initPath,
        blockchain: blockchainPath,
        gas: payload.gasLimit,
        isDeployment: isCodeDeployment,
      };
      retMsg = await runRemoteInterpreterAsync(apiReqParams);
    }

    // Extract state from tmp/out.json
    let newState = JSON.stringify(retMsg.states);
    if (isCodeDeployment) {
      newState = JSON.stringify(initializeContractState(payload.amount));
    }

    fs.writeFileSync(statePath, newState);
    LOG_SCILLA(`State logged down in ${statePath}`);
    console.log(`Contract Address Deployed: ${contractAddr}`);

    const responseData = {};
    responseData.gasRemaining = retMsg.gas_remaining;

    // Obtains the next address based on the message
    if (retMsg.message != null) {
      LOG_SCILLA(`Next address: ${retMsg.message._recipient}`);
      responseData.nextAddress = retMsg.message._recipient;
    }
    // Contract deployment runs do not have returned message
    responseData.nextAddress = '0'.repeat(40);

    return responseData;
  },
};

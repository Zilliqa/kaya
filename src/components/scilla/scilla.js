/*
 This file is part of kaya.
  Copyright (c) 2018 - present Zilliqa Research Pte. Ltd.

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
const path = require('path');
const { promisify } = require('util');
const rp = require('request-promise');
const { execFile } = require('child_process');
const { codeCleanup, logVerbose } = require('../../utilities');
const { InterpreterError } = require('../CustomErrors');
const config = require('../../config');

const logLabel = 'SCILLA';

const execFileAsync = promisify(execFile);
const fsWriteFileAsync = promisify(fs.writeFile);
const fsMkdirAsync = promisify(fs.mkdir);

const ensureExists = async (dirPath) => {
  const mask = 0o700;
  try {
    await fsMkdirAsync(dirPath, mask);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err; // ignore the error if the folder already exists
  }
};

const writeKayaFile = async (filePath, text) => {
  const dir = path.dirname(filePath);
  await ensureExists(dir);
  return fsWriteFileAsync(filePath, text);
};

const makeBlockchainJson = async (val, blockchainPath) => {
  const blockchainData = [
    {
      vname: 'BLOCKNUMBER',
      type: 'BNum',
      value: val.toString(),
    },
  ];
  await writeKayaFile(blockchainPath, JSON.stringify(blockchainData));
  logVerbose(logLabel, `blockchain.json file prepared for blocknumber: ${val}`);
};

// Scilla runner doesn't return the balance correctly
// We need to set it manually
const getStateWithCorrectBalance = (states, amount) => {
  logVerbose(logLabel, 'Payload amount', amount);
  const balanceIndex = states.findIndex(state => state.vname === '_balance');
  if (balanceIndex !== -1) {
    const newStates = [...states];
    newStates[balanceIndex] = {
      ...states[balanceIndex],
      value: amount.toString(),
    };
    return newStates;
  }
  return states;
};

/**
 * Runs the remote checker (currently hosted by Zilliqa)
 * @async
 * @method runRemoteCheckerAsync
 * @param { String } filepath to code
 */
const runRemoteCheckerAsync = async (filepath) => {
  logVerbose(logLabel, 'Running Remote Checker');
  const fullCode = fs.readFileSync(filepath, 'utf-8');
  const reqBody = { code: fullCode };

  const options = {
    method: 'POST',
    url: config.scilla.CHECKER_URL,
    json: true,
    body: reqBody,
  };

  try {
    await rp(options);
    logVerbose(logLabel, 'Contract passes type-checker');
  } catch (err) {
    if (err.statusCode === 400) {
      console.log('Error with type-checking [Remote Checker]');
    }
    throw new InterpreterError(`Error: ${err.message}`);
  }
};

/**
 * Runs the remote interpreter (currently hosted by zilliqa)
 * @async
 * @method runRemoteInterpreterAsync
 * @param {Object} data object containing the code, state, init, message and blockchain filepath
 * @returns: Output message received from the remote scilla interpreter
 */
const runRemoteInterpreterAsync = async (data) => {
  logVerbose(logLabel, 'Running Remote Interpreter');

  const reqData = {
    code: fs.readFileSync(data.code, 'utf-8'),
    init: fs.readFileSync(data.init, 'utf-8'),
    blockchain: fs.readFileSync(data.blockchain, 'utf-8'),
    gaslimit: data.gas,
  };

  if (!data.isDeployment) {
    // contract invoke requires state and message
    reqData.state = fs.readFileSync(data.state, 'utf-8');
    reqData.message = fs.readFileSync(data.msg, 'utf-8');
  }

  const options = {
    method: 'POST',
    url: config.scilla.RUNNER_URL,
    json: true,
    body: reqData,
  };

  logVerbose(logLabel, 'Attempting to run remote interpreter now');
  let response;
  try {
    response = await rp(options);
  } catch (err) {
    console.log('Interpreter failed to process code. Error message received:');
    console.log(`${err.message}`);
    console.log('Possible fix: Have your code passed type checking?');
    throw new InterpreterError('Remote interpreter failed to run');
  }

  // FIXME: Change error mechanism once the Scilla versioning is completed
  // https://github.com/Zilliqa/scilla/issues/291
  if (!response.message.gas_remaining) {
    console.log(
      'WARNING: You are using an outdated scilla interpreter. Please upgrade to the latest version',
    );
    throw new Error('Outdated scilla binaries');
  }

  return response.message;
};

/**
 * Executes the local interpreter
 * @async
 * @method runLocalInterpreterAsync
 * @param { Object } cmdOptions: Command options required to run the scilla interpreter
 * @param { String } outputPath : File path to the output file
 * @returns { Object } - response object
 */

const runLocalInterpreterAsync = async (cmdOptions, outputPath) => {
  logVerbose(logLabel, 'Running local scilla interpreter');

  const SCILLA_BIN_PATH = config.constants.smart_contract.SCILLA_RUNNER;
  // Run Scilla Interpreter
  if (!fs.existsSync(SCILLA_BIN_PATH)) {
    logVerbose(logLabel, 'Scilla runner not found. Hint: Have you compiled the scilla binaries?');
    throw new InterpreterError('Kaya RPC Runtime Error: Scilla-runner not found');
  }

  const result = await execFileAsync(SCILLA_BIN_PATH, cmdOptions);

  if (result.stderr !== '') {
    console.log(`Interpreter error: ${result.stderr}`);
    throw new InterpreterError(`Interpreter error: ${result.stderr}`);
  }

  logVerbose(logLabel, 'Scilla execution completed');

  const retMsg = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  return retMsg;
};

const runLocalCheckerAsync = async (cmdOptions) => {
  logVerbose(logLabel, 'Running local checker');
  const SCILLA_CHECKER_PATH = config.constants.smart_contract.SCILLA_CHECKER;
  if (!fs.existsSync(SCILLA_CHECKER_PATH)) {
    logVerbose(logLabel, 'Scilla checker not found. Hint: Have you compiled the scilla binaries?');
    throw new InterpreterError('Kaya RPC Runtime Error: Scilla-checker not found');
  }

  try {
    await execFileAsync(SCILLA_CHECKER_PATH, cmdOptions);
    logVerbose(logLabel, 'Contract passes type-checker');
  } catch (err) {
    console.log('Error: Typechecking failed. Possible fix: Run scilla-checker on your contract');
    throw new InterpreterError('Checker fails');
  }
};

module.exports = {

  /**
   * Takes arguments from `logic.js` and runs the scilla interpreter
   *
   * @method executeScillaRun
   * @async
   * @param { Object } payload - payload object from the message
   * @param { String } contractAddr - Contract address, only applicable if it is a deployment call
   * @param { String } senderAddress - message sender address
   * @param { String } directory of the data files
   * @param { String } current block number
   * @param { String } gasLimit - gasLimit specified by the caller
   * @returns {{ gasRemaining, nextAddress, events, message }} - interpreter response
   */
  executeScillaRun: async (payload, newContractAddr, senderAddr, dir, currentBnum) => {
    // Get the blocknumber into a json file
    const blockchainPath = `${dir}blockchain.json`;
    await makeBlockchainJson(currentBnum, blockchainPath);

    const toAddr = payload.toAddr && payload.toAddr.toLowerCase().replace('0x', '');
    const isCodeDeployment = payload.code && toAddr === '0'.repeat(40);
    const contractAddr = (isCodeDeployment ? newContractAddr : toAddr)

    const initPath = `${dir}${contractAddr}_init.json`;
    const codePath = `${dir}${contractAddr}_code.scilla`;
    const outputPath = `${dir}${contractAddr}_out.json`;
    const statePath = `${dir}${contractAddr}_state.json`;
    const msgPath = `${dir}${toAddr}_message.json`;

    const standardOpt = [
      '-libdir',
      config.constants.smart_contract.SCILLA_LIB,
      '-gaslimit',
      payload.gasLimit,
    ];
    const initOpt = ['-init', initPath];
    const outputOpt = ['-o', outputPath];
    const codeOpt = ['-i', codePath];
    const blockchainOpt = ['-iblockchain', blockchainPath];

    const cmdOpt = [].concat.apply([], [standardOpt, initOpt, outputOpt, codeOpt, blockchainOpt]);

    if (isCodeDeployment) {
      logVerbose(logLabel, 'Code Deployment');

      // get init data from payload
      const acceptedPayload = JSON.parse(payload.data);

      const thisAddr = {
        vname: '_this_address',
        type: 'ByStr20',
        value: `0x${contractAddr}`,
      };

      const thisCreationBlock = {
        vname: '_creation_block',
        type: 'BNum',
        value: `${currentBnum}`,
      };

      const deploymentPayload = [...acceptedPayload, thisAddr, thisCreationBlock];
      const initParams = JSON.stringify(deploymentPayload);
      await writeKayaFile(initPath, initParams);

      const rawCode = JSON.stringify(payload.code);
      const cleanedCode = codeCleanup(rawCode);
      await writeKayaFile(codePath, cleanedCode);
    } else {
      // Invoke transition
      logVerbose(logLabel, `Calling transition within contract ${payload.toAddr}`);

      logVerbose(logLabel, `Code Path: ${codePath}`);
      logVerbose(logLabel, `Init Path: ${initPath}`);
      if (!fs.existsSync(codePath) || !fs.existsSync(initPath)) {
        logVerbose(logLabel, 'Error, contract has not been created.');
        throw new Error('Address does not exist');
      }

      // Create message object from payload
      const msgObj = JSON.parse(payload.data);
      msgObj._amount = payload.amount;
      msgObj._sender = `0x${senderAddr}`;
      await writeKayaFile(msgPath, JSON.stringify(msgObj));

      // Append additional options for transition calls
      cmdOpt.push('-imessage');
      cmdOpt.push(msgPath);
      cmdOpt.push('-istate');
      cmdOpt.push(statePath);
    }

    if (!fs.existsSync(codePath) || !fs.existsSync(initPath)) {
      logVerbose(logLabel, 'Error, contract has not been created.');
      throw new Error('Address does not exist');
    }

    let retMsg;
    if (!config.scilla.remote) {
      const checkerCmdOpts = [...standardOpt, codePath];
      await runLocalCheckerAsync(checkerCmdOpts);
      // local scilla interpreter
      retMsg = await runLocalInterpreterAsync(cmdOpt, outputPath);
    } else {
      await runRemoteCheckerAsync(codePath);
      const apiReqParams = {
        output: outputPath,
        state: statePath,
        code: codePath,
        msg: msgPath,
        init: initPath,
        blockchain: blockchainPath,
        gas: payload.gasLimit,
        isDeployment: isCodeDeployment,
      };
      retMsg = await runRemoteInterpreterAsync(apiReqParams);
    }

    const prevStates = retMsg.states;
    const newStates = isCodeDeployment
      ? getStateWithCorrectBalance(prevStates, payload.amount)
      : prevStates;
    await writeKayaFile(statePath, JSON.stringify(newStates));
    logVerbose(logLabel, `State logged down in ${statePath}`);
    if (isCodeDeployment) logVerbose(logLabel, `Contract Address Deployed: ${contractAddr}`);

    const responseData = {};
    responseData.gasRemaining = retMsg.gas_remaining;
    if (retMsg.events) {
      responseData.events = retMsg.events.map(e => ({
        ...e,
        address: payload.toAddr,
      }));
    }
    const message = retMsg.message;
    if (message != null) {
      responseData.message = message;

      // Obtains the next address based on the message
      logVerbose(logLabel, `Next address: ${message._recipient}`);
      responseData.nextAddress = message._recipient;
    } else {
      // Contract deployment do not have the next address
      responseData.nextAddress = '0'.repeat(40);
    }
    return responseData;
  },
};

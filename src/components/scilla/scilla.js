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

const fs = require("fs");
const { promisify } = require("util");
const rp = require("request-promise");
const { execFile } = require("child_process");
const { paramsCleanup, codeCleanup, logVerbose } = require("../../utilities");
const { InterpreterError } = require('../CustomErrors');
const config = require("../../config");
const logLabel = "Scilla";

const execFileAsync = promisify(execFile);


const makeBlockchainJson = (val, blockchainPath) => {
  const blockchainData = [
    {
      vname: "BLOCKNUMBER",
      type: "BNum",
      value: val.toString(),
    },
  ];
  fs.writeFileSync(blockchainPath, JSON.stringify(blockchainData));
  logVerbose(logLabel, `blockchain.json file prepared for blocknumber: ${val}`);
};

const initializeContractState = amt => {
  const initState = [
    {
      vname: "_balance",
      type: "Uint128",
      value: amt.toString(),
    },
  ];
  return initState;
};
/**
 * Runs the remote interpreter (currently hosted by zilliqa)
 * @async
 * @method runRemoteInterpreterAsync
 * @param {Object} data object containing the code, state, init, message and blockchain filepath
 * @returns: Output message received from the remote scilla interpreter
 */

const runRemoteInterpreterAsync = async data => {
  logVerbose(logLabel, "Running Remote Interpreter");
  console.log('throwing interpreter error');
  throw new InterpreterError('Remote interpreter is currently unavailable');

  const reqData = {
    code: fs.readFileSync(data.code, "utf-8"),
    init: fs.readFileSync(data.init, "utf-8"),
    blockchain: fs.readFileSync(data.blockchain, "utf-8"),
    gaslimit: data.gas,
  };

  if (!data.isDeployment) {
    // contract invoke requires state and message
    reqData.state = fs.readFileSync(data.state, "utf-8");
    reqData.message = data.msg;
  }

  const options = {
    method: "POST",
    url: config.scilla.url,
    json: true,
    body: reqData,
  };

  logVerbose(logLabel, 'Attempting to run remote interpreter now');
  let response;
  try {
    response = await rp(options);
  } catch (err) {
    console.log(`Interpreter failed to process code. Error message received:`);
    console.log(`${err.message}`);
    console.log("Possible fix: Have your code passed type checking?");
    throw new InterpreterError('Remote interpreter failed to run')
  }

  // FIXME: Change error mechanism once the Scilla versioning is completed
  // https://github.com/Zilliqa/scilla/issues/291
  if (!response.message.gas_remaining) {
    console.log(
      "WARNING: You are using an outdated scilla interpreter. Please upgrade to the latest version"
    );
    throw new Error("Outdated scilla binaries");
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
  logVerbose(logLabel, "Running local scilla interpreter");

  const SCILLA_BIN_PATH = config.constants.smart_contract.SCILLA_BINARY;
  // Run Scilla Interpreter
  if (!fs.existsSync(SCILLA_BIN_PATH)) {
    logVerbose(logLabel, "Scilla runner not found. Hint: Have you compiled the scilla binaries?");
    throw new InterpreterError("Kaya RPC Runtime Error: Scilla-runner not found");
  }

  const result = await execFileAsync(SCILLA_BIN_PATH, cmdOptions);
  if (result.stderr !== "") {
    console.log(`Interpreter error: ${result.stderr}`);
    throw new InterpreterError(`Interpreter error: ${result.stderr}`);
  }

  logVerbose(logLabel, "Scilla execution completed");

  const retMsg = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
  return retMsg;
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
   * @returns { Object } consisting of `gasRemaining and nextAddress`
   */
  executeScillaRun: async (payload, contractAddr, senderAddr, dir, currentBnum) => {
    // Get the blocknumber into a json file
    const blockchainPath = `${dir}blockchain.json`;
    makeBlockchainJson(currentBnum, blockchainPath);

    let isCodeDeployment = payload.code && payload.toAddr === "0".repeat(40);
    contractAddr = (isCodeDeployment) ? contractAddr : payload.toAddr;

    const initPath = `${dir}${contractAddr}_init.json`;
    const codePath = `${dir}${contractAddr}_code.scilla`;
    const outputPath = `${dir}${contractAddr}_out.json`;
    const statePath = `${dir}${contractAddr}_state.json`;

    const standardOpt = ['-libdir', config.constants.smart_contract.SCILLA_LIB, '-gaslimit', payload.gasLimit];
    const initOpt = ['-init', initPath];
    const outputOpt = ['-o', outputPath];
    const codeOpt = ['-i', codePath];
    const blockchainOpt = ['-iblockchain', blockchainPath];

    const cmdOpt = [].concat.apply([], [standardOpt, initOpt, outputOpt, codeOpt, blockchainOpt])

    if (isCodeDeployment) {
      logVerbose(logLabel, "Code Deployment");

      // get init data from payload
      const acceptedPayload = JSON.parse(payload.data);

      const thisAddr = {
        vname: "_this_address",
        type: "ByStr20",
        value: `0x${contractAddr}`
      };

      const thisCreationBlock = {
        "vname": "_creation_block",
        "type" : "BNum",
        "value" : `${currentBnum}`
    };

      const deploymentPayload = [...acceptedPayload, thisAddr, thisCreationBlock];    
      const initParams = JSON.stringify(deploymentPayload);
      fs.writeFileSync(initPath, initParams);

      const rawCode = JSON.stringify(payload.code);
      const cleanedCode = codeCleanup(rawCode);
      fs.writeFileSync(codePath, cleanedCode);
    } else {
      // Invoke transition
      logVerbose(logLabel, `Calling transition within contract ${payload.toAddr}`);

      logVerbose(logLabel, `Code Path: ${codePath}`);
      logVerbose(logLabel, `Init Path: ${initPath}`);
      if (!fs.existsSync(codePath) || !fs.existsSync(initPath)) {
        logVerbose(logLabel, "Error, contract has not been created.");
        throw new Error("Address does not exist");
      }

      // Create message object from payload
      const msgPath = `${dir}${payload.toAddr}_message.json`;
      msgObj = JSON.parse(payload.data);
      msgObj._amount = payload.amount;
      msgObj._sender = `0x${senderAddr}`;
      console.log(msgObj);
      fs.writeFileSync(msgPath, JSON.stringify(msgObj));

      // Append additional options for transition calls
      cmdOpt.push('-imessage');
      cmdOpt.push(msgPath);
      cmdOpt.push('-istate');
      cmdOpt.push(statePath);
    }

    if (!fs.existsSync(codePath) || !fs.existsSync(initPath)) {
      logVerbose(logLabel, "Error, contract has not been created.");
      throw new Error("Address does not exist");
    }

    let retMsg;

    if (!config.scilla.remote) {
      // local scilla interpreter
      retMsg = await runLocalInterpreterAsync(cmdOpt, outputPath);
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
    logVerbose(logLabel, `State logged down in ${statePath}`);
    console.log(`Contract Address Deployed: ${contractAddr}`);

    const responseData = {};
    responseData.gasRemaining = retMsg.gas_remaining;

    // Obtains the next address based on the message
    if (retMsg.message != null) {
      logVerbose(logLabel, `Next address: ${retMsg.message._recipient}`);
      responseData.nextAddress = retMsg.message._recipient;
    }
    // Contract deployment do not have the next address
    responseData.nextAddress = "0".repeat(40);

    return responseData;
  },
};

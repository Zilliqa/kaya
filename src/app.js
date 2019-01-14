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
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const rimraf = require('rimraf');
const yargs = require('yargs');
const expressjs = express();
const config = require('./config');
const logic = require('./logic');
const wallet = require('./components/wallet/wallet');
const utils = require('./utilities');
const initArgv = require('./argv');
const zCore = require('@zilliqa-js/core')


expressjs.use(bodyParser.json({ extended: false }));
let argv;
if (process.env.NODE_ENV !== 'test') {
  argv = initArgv(yargs).argv;
} else {
  console.log('-------- TEST MODE -------------');
  argv = config.testconfigs.args;
}

const logLabel = 'App.js';
const errorCodes = zCore.RPCErrorCode;


/**
 * Make the response headers before returning to client
 * @method makeResponse
 * @param { String } id 
 * @param { String} jsonrpc 
 * @param { Object } data 
 * @param { Boolean } isErr 
 */
const makeResponse = (id, jsonrpc, data, isErr) => {
  const responseObj = { id, jsonrpc };
  let errorObj;
  if (isErr) {
    errorObj = {
      code: data.code,
      data: data.data,
      message: data.message
    }
  }
  return isErr ? { ...responseObj, error: errorObj } : { ...responseObj, result: data };
}

const wrapAsync = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

if (argv.d.trim() === 'saved/') {
  throw new Error('Saved dir is reserved for saved files');
}

// Stores all the option flags and configurations
// Console defined flag will override the config settings
let options = {
  fixtures: argv.f,
  numAccts: argv.n,
  dataPath: argv.d,
  remote: argv.r,
  verbose: argv.v,
  save: argv.s,
  load: argv.l
}

utils.consolePrint(`Running from ${options.remote ? 'remote' : 'local'} interpreter`)
if (options.remote) { utils.consolePrint(config.scilla.url) };
utils.consolePrint('='.repeat(80));

utils.prepareDirectories(options.dataPath); // prepare the directories required

if (options.save) {
  utils.logVerbose(logLabel, 'Save enabled. Data files from this session will be saved');
}

if (options.load) {
  // loading option specified
  utils.logVerbose(logLabel, 'Loading option specified. Loading files now...');
  // loads file into dbPath from the given bootstrap file
  const importedData = utils.loadData(options.load);
  wallet.loadAccounts(importedData.accounts);
  logic.utils.loadData(importedData.transactions, importedData.createdContractsByUsers);
  utils.loadDataToDir(options.dataPath, importedData);
  utils.logVerbose(logLabel, 'Load completed');
}

if (process.env.NODE_ENV === 'test') {
  options.fixtures = 'test/account-fixtures.json';
}

/* 
* Account creation/loading based on presets given 
* @dev : Only create wallets if the user does not supply any load file
*/
if (!options.load) {
  if (options.fixtures) {
    utils.logVerbose(logLabel, `Bootstrapping from account fixture files: ${options.fixtures}`);
    const accountsPath = options.fixtures;
    if (!fs.existsSync(accountsPath)) {
      throw new Error('Account Path Invalid');
    }
    const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
    wallet.loadAccounts(accounts);
  } else {
    /* Create Dummy Accounts */
    wallet.createWallets(options.numAccts);
  }
}

wallet.printWallet();

// cross region settings with Env
if (process.env.NODE_ENV === 'dev') {
  expressjs.use(cors());
  utils.logVerbose(logLabel, 'CORS Enabled');
}

expressjs.get('/', (req, res) => {
  res.status(200).send('Kaya RPC Server');
});

// Method handling logic for incoming POST request

const handler = async (req, res) => {
  const { body } = req;
  let data = {};
  let result;
  let addr;
  utils.logVerbose(logLabel, `Method specified ${body.method}`);
  switch (body.method) {
    case 'GetBalance':
      addr = body.params[0];
      if (typeof addr === 'object') {
        addr = JSON.stringify(addr);
      }
      utils.logVerbose(logLabel, `Getting balance for ${addr}`);
      try {
        data = wallet.getBalance(addr);
      } catch (err) {
        res.status(200).send(makeResponse(body.id, body.jsonrpc, err, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetNetworkId':
      data = makeResponse(body.id, body.jsonrpc, 'TestNet', false);
      res.status(200).send(data);
      break;
    case 'GetSmartContractCode':
      try {
        result = logic.processGetDataFromContract(body.params, options.dataPath, 'code');
        data = result;
      } catch (err) {
        res.status(200).send(makeResponse(body.id, body.jsonrpc, err, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetSmartContractState':
      try {
        result = logic.processGetDataFromContract(body.params, options.dataPath, 'state');
        data = result;
      } catch (err) {
        res.status(200).send(makeResponse(body.id, body.jsonrpc, err, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetSmartContractInit':
      try {
        result = logic.processGetDataFromContract(body.params, options.dataPath, 'init');
        data = result;
      } catch (err) {
        res.status(200).send(makeResponse(body.id, body.jsonrpc, err, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetSmartContracts':
      try {
        result = logic.processGetSmartContracts(body.params, options.dataPath);
        data = result;
      } catch (err) {
        res.status(200).send(makeResponse(body.id, body.jsonrpc, err, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'CreateTransaction':
      console.log(body.params);
      try {
        const txnId = await logic.processCreateTxn(body.params, options);
        data = txnId;
      } catch (err) {
        res.status(200).send(makeResponse(body.id, body.jsonrpc, err, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetTransaction':
      try {
        const obj = logic.processGetTransaction(body.params);
        data = obj;
      } catch (err) {
        res.status(200).send(makeResponse(body.id, body.jsonrpc, err, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetRecentTransactions':
      try {
        const obj = logic.processGetRecentTransactions();
        data = obj;
      } catch (err) {
        res.status(200).send(makeResponse(body.id, body.jsonrpc, err, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetContractAddressFromTransactionID':
      try {
        const result = logic.processGetContractAddressByTransactionID(body.params);
        data = result;
      } catch (err) {
        res.status(200).send(makeResponse(body.id, body.jsonrpc, err, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetMinimumGasPrice':
      data = makeResponse(body.id, body.jsonrpc, config.blockchain.minimumGasPrice.toString(), false);
      res.status(200).send(data);
      break;
    default:
      data = {
        code: errorCodes.RPC_INVALID_REQUEST,
        message: 'METHOD_NOT_FOUND: The method being requested is not available on this server'
      };
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
  }
  utils.logVerbose(logLabel, 'Sending response back to client');
};

expressjs.post('/', wrapAsync(handler));

// Function below handles the end of the session due to SIGINT. It will save
// data files if the `-s` flag is toggled and will remove all files from the data directory
process.on('SIGINT', function () {
  utils.consolePrint("Gracefully shutting down from SIGINT (Ctrl-C)");

  // If `save` is enabled, store files under the saved/ directory
  if (options.save) {
    console.log(`Save mode enabled. Extracting data now..`);

    const dir = config.savedFilesDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    // Saved files will be prefixed with the timestamp when the user decides to end the session
    const timestamp = utils.getDateTimeString();

    const outputData = `${dir}${timestamp}`;
    const targetFilePath = `${outputData}_data.json`;
    utils.consolePrint(`Files will be saved at ${targetFilePath}`);

    // Prepares Data to be exported
    utils.consolePrint('Extracting data...');
    const data = logic.exportData();
    data.accounts = wallet.getAccounts();
    utils.consolePrint(`[1/5] Transactions and account data extracted`);
    data.states = utils.getDataFromDir(options.dataPath, 'state.json');
    utils.consolePrint(`[2/5] Contract state data extracted`);
    data.init = utils.getDataFromDir(options.dataPath, 'init.json');
    utils.consolePrint(`[3/5] Contract init data extracted`);
    data.codes = utils.getDataFromDir(options.dataPath, 'code.scilla');
    utils.consolePrint(`[4/5] Contract code data extracted`);

    // Writing to the final exported data file in JSON format
    fs.writeFileSync(targetFilePath, JSON.stringify(data));
    utils.consolePrint(`[5/5] Data file written to ${targetFilePath}`);

    utils.consolePrint(`Save successful`)
  }

  // remove files from the db_path
  rimraf.sync(`${options.dataPath}*`);
  console.log(`Files from ${options.dataPath} removed. Shutting down now.`);
  process.exit(0);
})

module.exports = {
  expressjs,
  wallet,
};

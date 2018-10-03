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
const { prepareDirectories, logVerbose, consolePrint, 
  getDateTimeString, getDataFromDir, loadData, loadDataToDir } = require('./utilities');
const init = require('./argv');
const logLabel = 'App.js';

expressjs.use(bodyParser.json({ extended: false }));
const argv = init(yargs).argv;

const makeResponse = (id, jsonrpc, data, isErr) => {
  const responseObj = { id, jsonrpc };
  responseObj.result = isErr ? { Error: data } : data;
  return responseObj;
}

const wrapAsync = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

if (argv.db.trim() === 'saved/') {
  throw new Error('Saved dir is reserved for saved files');
}

// Stores all the option flags and configurations
// Console defined flag will override the config settings
let options = {
  fixtures: argv.f,
  numAccts: argv.n,
  dataPath: argv.db,
  remote: argv.r,
  verbose: argv.v,
  save: argv.s,
  load: argv.l
}

consolePrint(`Running from ${options.remote ? 'remote' : 'local'} interpreter`)
if (options.remote) { consolePrint(config.scilla.url) };
consolePrint('='.repeat(80));

prepareDirectories(options.dataPath); // prepare the directories required

if (options.save) {
  logVerbose(logLabel, 'Save enabled. Data files from this session will be saved');
}

if (options.load) {
  // loading option specified
  logVerbose(logLabel, 'Loading option specified. Loading files now...');
  // loads file into dbPath from the given bootstrap file
  const importedData = loadData(options.load);
  wallet.loadAccounts(importedData.accounts);
  logic.loadData(importedData.transactions, importedData.createdContractsByUsers);
  loadDataToDir(options.dataPath, importedData);
  logVerbose(logLabel, 'Load completed');
}

if (process.env.NODE_ENV === 'test') {
  options.fixtures = 'test/account-fixtures.json';
}

/* 
* Account creation/loading based on presets given 
* @dev : Only create wallets if the user does not supply any load file
*/
if(!options.load) { 
  if (options.fixtures) {
    logVerbose(logLabel, `Bootstrapping from account fixture files: ${options.fixtures}`);
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
  logVerbose(logLabel, 'CORS Enabled');
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
  logVerbose(logLabel, `Method specified ${body.method}`);
  switch (body.method) {
    case 'GetBalance':
      // [addr, ... ] = body.params;
      addr = body.params[0];
      if (typeof addr === 'object') {
        addr = JSON.stringify(addr);
      }
      logVerbose(logLabel, `Getting balance for ${addr}`);

      try {
        data = wallet.getBalance(addr);
      } catch (err) {
        data = err.message;
        res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetNetworkId':
      data = makeResponse(body.id, body.jsonrpc, 'Testnet', false);
      res.status(200).send(data);
      break;
    case 'GetSmartContractCode':
      try {
        result = logic.processGetDataFromContract(body.params, options.dataPath, 'code');
        data = result;
      } catch (err) {
        data = err.message;
        res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetSmartContractState':
      try {
        result = logic.processGetDataFromContract(body.params, options.dataPath, 'state');
        data = result;
      } catch (err) {
        data = err.message;
        res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetSmartContractInit':
      try {
        result = logic.processGetDataFromContract(body.params, options.dataPath, 'init');
        data = result;
      } catch (err) {
        data = err.message;
        res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetSmartContracts':
      try {
        result = logic.processGetSmartContracts(body.params, options.dataPath);
        data = result;
      } catch (err) {
        data = err.message;
        res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'CreateTransaction':
      try {
        const txnId = await logic.processCreateTxn(body.params, options);
        data = txnId;
      } catch (err) {
        data = err.message;
        res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetTransaction':
      try {
        const obj = logic.processGetTransaction(body.params);
        data = obj;
      } catch (err) {
        data = err.message;
        res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    case 'GetRecentTransactions':
      try {
        const obj = logic.processGetRecentTransactions();
        data = obj;
      } catch (err) {
        data = err.message;
        res.status(200).send(makeResponse(body.id, body.jsonrpc, data, true));
        break;
      }
      res.status(200).send(makeResponse(body.id, body.jsonrpc, data, false));
      break;
    default:
      data = { Error: 'Unsupported Method' };
      res.status(404).send(data);
  }
  logVerbose(logLabel, 'Sending response back to client');
};

expressjs.post('/', wrapAsync(handler));

process.on('SIGINT', function () {
  consolePrint("Gracefully shutting down from SIGINT (Ctrl-C)");

  // If `save` is enabled, store files under the saved/ directory
  if (options.save) {
    console.log(`Save mode enabled. Extracting data now..`);
    // move data files to saved files directory
    const dir = config.savedFilesDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    const timestamp = getDateTimeString();
    
    const outputData = `${dir}${timestamp}`;
    const targetFilePath = `${outputData}_data.json`;
    consolePrint(`Files will be saved at ${targetFilePath}`);

    // Extracts Data to be exported
    consolePrint('Extracting data...');
    const data = logic.exportData();
    data.accounts = wallet.getAccounts();
    consolePrint(`[1/5] Transactions and account data extracted`);
    // Extracts State JSONs
    data.states = getDataFromDir(options.dataPath, 'state.json');
    consolePrint(`[2/5] Contract state data extracted`);
    data.init = getDataFromDir(options.dataPath, 'init.json');
    consolePrint(`[3/5] Contract init data extracted`);
    data.codes = getDataFromDir(options.dataPath, 'code.scilla');
    consolePrint(`[4/5] Contract code data extracted`);

    fs.writeFileSync(targetFilePath, JSON.stringify(data));
    consolePrint(`[5/5] Data file written to ${targetFilePath}`);
  }

  // remove files from the db_path
  rimraf.sync(`${options.dataPath}*`);
  console.log(`Files from ${options.dataPath} removed.`);
  process.exit(0);  
})

module.exports = {
  expressjs,
  wallet,
};

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

const express = require('express');
const bodyParser = require('body-parser');
const expressjs = express();
const fs = require('fs');
const cors = require('cors');
const yargs = require('yargs');

const config = require('./config');
const logic = require('./logic');
const wallet = require('./components/wallet/wallet');
const { prepareDirectories, logVerbose, consolePrint } = require('./utilities');
const init = require('./argv');
const logLabel = 'App.js';

expressjs.use(bodyParser.json({ extended: false }));
const argv = init(yargs).argv;

const makeResponse = (id, jsonrpc, data, isErr) => {
    const responseObj = {id, jsonrpc};
    responseObj.result = isErr ? { Error: data } : data;
    return responseObj;
  }

// flags override the config files
let options = {
  fixtures: argv.f,
  numAccts: argv.n,
  data_path : argv.db,
  remote : argv.r,
  verbose : argv.v,
  save : argv.s,
  load : argv.l
}
consolePrint(`Running from ${options.remote ? 'remote' : 'local'} interpreter`)
if(options.remote) { consolePrint(config.scilla.url)};
consolePrint('='.repeat(80));

prepareDirectories(options.data_path); // prepare the directories required
let isPersistence = false; // tmp is the default behavior

if (options.save) {
  logVerbose(logLabel, 'Save enabled. Data files from this session will be saved');
  isPersistence = true;
}

if (options.load) {
  // loading option specified
  logVerbose(logLabel, 'Loading option specified');
  // loads file into db_path from the given bootstrap file
  logic.bootstrapFile(options.load);
  isPersistence = true;
}

if (process.env.NODE_ENV === 'test') {
  options.fixtures = 'test/account-fixtures.json';
}

/* account creation/loading based on presets given */
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

wallet.printWallet();

const wrapAsync = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

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
        result = logic.processGetSmartContractCode(body.params, options.data_path);
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
        result = logic.processGetSmartContractState(body.params, options.data_path);
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
        result = logic.processGetSmartContractInit(body.params, options.data_path);
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
        result = logic.processGetSmartContracts(body.params, options.save);
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

process.on( 'SIGINT', function() {
    consolePrint( "Gracefully shutting down from SIGINT (Ctrl-C)" );

    // move data files to saved files directory

    process.exit(0);
})

module.exports = {
  expressjs,
  wallet,
};

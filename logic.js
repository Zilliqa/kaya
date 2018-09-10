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

// logic.js : Logic Script
const hashjs = require('hash.js');
const fs = require('fs');
const { Zilliqa } = require('zilliqa-js');
// debug usage: DEBUG=scilla-txn node server.js
const LOG_LOGIC = require('debug')('kaya:logic');

const scillaCtrl = require('./components/scilla/scilla');
const walletCtrl = require('./components/wallet/wallet');
const blockchain = require('./components/blockchain');



// non-persistent states. Initializes whenever server starts
const repo = {};
const transactions = {};
var createdContractsByUsers = {};
var map_Caddr_owner = {};

/*  Dummy constructor for zilliqajs */
// @dev: Will be replaced once zilliqa-js exposes utils without constructors
const zilliqa = new Zilliqa({
  nodeUrl: 'http://localhost:8888',
});

/* Utility functions */

function pad(number, length) {
  let str = '' + number;
  while (str.length < length) {
    str = '0' + str;
  }
  return str;
}

Date.prototype.YYYYMMDDHHMMSS = function() {
  var yyyy = this.getFullYear().toString();
  var MM = pad(this.getMonth() + 1, 2);
  var dd = pad(this.getDate(), 2);
  var hh = pad(this.getHours(), 2);
  var mm = pad(this.getMinutes(), 2);
  var ss = pad(this.getSeconds(), 2);
  return yyyy + MM + dd + hh + mm + ss;
};

// compute contract address from the sender's current nonce
const computeContractAddr = (sender) => {
  const userNonce = walletCtrl.getBalance(sender).nonce;
  const nonceStr = zilliqa.util.intToByteArray(userNonce, 64).join('');
  const digest = hashjs.sha256().update(sender).update(nonceStr).digest('hex');
  return digest.slice(24);
}

// compute transactionHash from the payload
const computeTransactionHash = (payload) => { 
  // transactionID is a sha256 digest of txndetails
  const copyPayload = JSON.parse(JSON.stringify(payload));
  delete copyPayload.signature; // txn hash does not include signature
  const buf = Buffer.from(JSON.stringify(copyPayload));
  const transactionHash = hashjs.sha256().update(buf).digest('hex');
  return transactionHash;
}

// check for common elements within the list
const intersect = (a, b) => {
  return [...new Set(a)].filter(x => new Set(b).has(x));
}


// checks if the transactionJson is well-formed
const checkTransactionJson = (data) => { 
  if(data !== null && typeof data !== 'object') return false;
  payload = data[0];

  /* Checking the keys in the payload */
  numKeys = Object.keys(payload).length;
  if(numKeys < 8) return false;
  expectedFields = ['version','nonce','to','amount','pubKey','gasPrice','gasLimit','signature'];
  payloadKeys = Object.keys(payload);
  expected = intersect(payloadKeys, expectedFields).length;
  actual = Object.keys(expectedFields).length;
  // number of overlap keys must be the same as the expected keys
  if( expected !== actual) return false;

  // validate signature - TODO

  return true;
}

module.exports = {
  processCreateTxn: async (data, saveMode) => {
    LOG_LOGIC('Processing transaction...');
    // todo: check for well-formness of the payload data
    LOG_LOGIC(`Payload well-formed? ${checkTransactionJson(data)}`);
    if (!checkTransactionJson(data)) {
      throw new Error('Invalid Tx Json');
    }

    const currentBNum = blockchain.getBlockNum();
    let dir = 'tmp/';
    if (saveMode) {
      console.log('Save mode enabled.');
      dir = 'data/';
    }

    const payload = data[0];
    const senderAddress = zilliqa.util.getAddressFromPublicKey(payload.pubKey);

    LOG_LOGIC(`Sender: ${senderAddress}`);
    const userNonce = walletCtrl.getBalance(senderAddress).nonce;
    LOG_LOGIC(`User Nonce: ${userNonce}`);
    LOG_LOGIC(`Payload Nonce: ${payload.nonce}`);

    // check if the payload.nonce is valid
    if (payload.nonce === userNonce + 1) {
      // p2p token transfer
      if (!payload.code && !payload.data) {
        LOG_LOGIC('p2p token tranfer');
        walletCtrl.deductFunds(senderAddress, payload.amount + payload.gasLimit);
        walletCtrl.increaseNonce(senderAddress);
        walletCtrl.addFunds(payload.to, payload.amount);
      } else {
        /* contract generation */
        LOG_LOGIC('Task: Contract Deployment / Create Transaction'); 
        // take the sha256 hash of address+nonce, then extract the rightmost 20 bytes
        const contractAddr = computeContractAddr(senderAddress);

        // @dev: currently, the gas cost is the gaslimit. This WILL change in the future
        const gasAndAmount = payload.amount + payload.gasLimit;
        if (!walletCtrl.sufficientFunds(senderAddress, gasAndAmount)) {
          LOG_LOGIC('Insufficient funds. Returning error to client.');
          throw new Error('Insufficient funds');
        }
        LOG_LOGIC(`Contract will be deployed at: ${contractAddr}`);

        const nextAddr = await scillaCtrl.executeScillaRun(
          payload,
          contractAddr,
          dir,
          currentBNum,
        );
        // Deduct funds
        walletCtrl.deductFunds(senderAddress, payload.amount + payload.gasLimit);
        walletCtrl.increaseNonce(senderAddress); // only increase if a contract is successful


        if (nextAddr != '0'.repeat(40) && nextAddr.substring(2) != senderAddress) {
          console.log('Multi-contract calls not supported.');
          throw new Error('Multi-contract calls are not supported yet.')
        }

        // Only update if it is a deployment call
        if (payload.code && payload.to === '0'.repeat(40)) {
          // Update address_to_contracts
          if (senderAddress in createdContractsByUsers) {
            LOG_LOGIC('User has contracts. Appending to list');
            createdContractsByUsers[senderAddress].push(contractAddr);
          } else {
            LOG_LOGIC('No existing contracts. Creating new entry.');
            createdContractsByUsers[senderAddress] = [contractAddr];
          }
          LOG_LOGIC('Addr-to-Contracts: %O', createdContractsByUsers);
        }
      }
    } else {
      // payload.nonce is not valid. Deduct gas anyway
      walletCtrl.deductFunds(senderAddress, payload.gasLimit);
      LOG_LOGIC('Invalid Nonce');
      throw new Error('Invalid Tx Json');
    }

    /*  Update Transactions */
    const txnId = computeTransactionHash(payload);
    LOG_LOGIC(`Transaction will be logged as ${txnId}`);
    const txnDetails = {
      ID: txnId,
      amount: payload.amount,
      nonce: payload.nonce,
      senderPubKey: payload.pubKey,
      signature: payload.signature,
      toAddr: payload.to,
      version: payload.version,
    };
    transactions[txnId] = txnDetails;

    return txnId;
  },

  bootstrapFile: (filepath) => {
    // bootstraps state of transactions and caddr owner
    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    LOG_LOGIC('State of blockchain:');
    transactions = data.transactions;
    repo = data.repo;
    map_Caddr_owner = data.map_Caddr_owner;
    LOG_LOGIC(transactions);
  },

  // dumpDataFiles: data => {
  //   // save the state of transactions
  //   const data = {};
  //   data.transactions = transactions;
  //   data.createdContractsByUsers = createdContractsByUsers;
  //   data.map_Caddr_owner = map_Caddr_owner;
  //   data.repo = repo;
  //   var d = new Date();
  //   save_filename = `data/save/${d.YYYYMMDDHHMMSS()}_blockchain_states.json`;
  //   console.log(`Save Mode Enabled: Files will be saved in ${save_filename}`);
  //   fs.writeFileSync(save_filename, JSON.stringify(data, 'UTF-8'));
  // },

  processGetTransaction: data => {
    if (!data) {
      LOG_LOGIC('Invalid params');
      err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised'
      );
      throw err;
    }

    LOG_LOGIC(`TxnID: ${data[0]}`);
    var data = transactions[data[0]];
    if (data) {
      return data;
    }
    throw new Error('Txn Hash not Present.');
  },

  processGetRecentTransactions: data => {
    LOG_LOGIC(`Getting Recent Transactions`);

    var txnhashes = Object.keys(transactions);
    var responseObj = {};
    responseObj.TxnHashes = txnhashes.reverse();
    responseObj.number = txnhashes.length;
    return responseObj;
  },

  processGetSmartContractInit: (data, saveMode) => {
    LOG_LOGIC(`Getting SmartContract Init`);
    if (!data) {
      LOG_LOGIC('Invalid params');
      err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised'
      );
      throw err;
    }

    contract_addr = data[0];
    if (contract_addr == null || !zilliqa.util.isAddress(contract_addr)) {
      console.log('Invalid request');
      throw new Error('Address size inappropriate');
    }

    dir = saveMode ? 'data/' : 'tmp/';
    var init_json = `${dir}${contract_addr.toLowerCase()}_init.json`;
    if (!fs.existsSync(init_json)) {
      console.log(`No init file found (Contract: ${contract_addr}`);
      throw new Error('Address does not exist');
    }
    var retMsg = JSON.parse(fs.readFileSync(init_json, 'utf-8'));
    return retMsg;
  },

  processGetSmartContractCode: (data, saveMode) => {
    LOG_LOGIC(`Getting SmartContract code`);
    if (!data) {
      LOG_LOGIC('Invalid params');
      err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised'
      );
      throw err;
    }

    contract_addr = data[0];
    if (contract_addr == null || !zilliqa.util.isAddress(contract_addr)) {
      console.log('Invalid request');
      throw new Error('Address size inappropriate');
    }

    dir = saveMode ? 'data/' : 'tmp/';
    var code_path = `${dir}${contract_addr.toLowerCase()}_code.scilla`;
    if (!fs.existsSync(code_path)) {
      console.log(`No code file found (Contract: ${contract_addr}`);
      throw new Error('Address does not exist');
    }
    LOG_LOGIC('Returning smart contract code to caller.');
    data = {};
    data['code'] = fs.readFileSync(code_path, 'utf-8');
    return data;
  },

  processGetSmartContractState: (data, saveMode) => {
    LOG_LOGIC(`Getting SmartContract State`);
    if (!data) {
      LOG_LOGIC('Invalid params');
      err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised'
      );
      throw err;
    }

    contract_addr = data[0];
    if (contract_addr == null || !zilliqa.util.isAddress(contract_addr)) {
      console.log('Invalid request');
      throw new Error('Address size inappropriate');
    }

    dir = saveMode ? 'data/' : 'tmp/';
    var state_json = `${dir}${contract_addr.toLowerCase()}_state.json`;
    if (!fs.existsSync(state_json)) {
      console.log(`No state file found (Contract: ${contract_addr}`);
      throw new Error('Address does not exist');
    }
    var retMsg = JSON.parse(fs.readFileSync(state_json, 'utf-8'));
    console.log(retMsg);
    return retMsg;
  },

  /*
getSmartContracts: Returns the list of smart contracts created by 
an account
*/
  processGetSmartContracts: (data, saveMode) => {
    if (!data) {
      LOG_LOGIC('Invalid params');
      err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised'
      );
      throw err;
    }

    let addr = data[0];
    console.log(`Getting smart contracts created by ${addr}`);
    if (addr == null || !zilliqa.util.isAddress(addr)) {
      console.log('Invalid request');
      throw new Error('Address size inappropriate');
    }

    var stateLists = [];
    if (!createdContractsByUsers[addr]) {
      throw new Error('Address does not exist');
    }
    // Addr found - proceed to append state to return list
    dir = saveMode ? 'data/' : 'tmp/';
    contracts = createdContractsByUsers[addr];
    for (var i in contracts) {
      contractID = contracts[i];

      var state_json = `${dir}${contractID.toLowerCase()}_state.json`;
      if (!fs.existsSync(state_json)) {
        console.log(`No state file found (Contract: ${contractID}`);
        throw new Error('Address does not exist');
      }
      var retMsg = JSON.parse(fs.readFileSync(state_json, 'utf-8'));
      var data = {};
      data.address = contractID;
      data.state = retMsg;
      stateLists.push(data);
    }

    return stateLists;
  }
};

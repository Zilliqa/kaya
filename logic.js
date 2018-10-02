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
const scillaCtrl = require('./components/scilla/scilla');
const walletCtrl = require('./components/wallet/wallet');
const blockchain = require('./components/blockchain');
const { logVerbose, consolePrint } = require('./utilities');
const config = require('./config');

const logLabel = ('Logic.js');

// non-persistent states. Initializes whenever server starts
let transactions = {};
const createdContractsByUsers = {}; // address => contract addresses

/*  Dummy constructor for zilliqajs */
// @dev: Will be replaced once zilliqa-js exposes utils without constructors
const zilliqa = new Zilliqa({
  nodeUrl: 'http://localhost:8888',
});

/* Utility functions */

function pad(number, length) {
  let str = number.toString();
  while (str.length < length) {
    str = `0${str}`;
  }
  return str;
}

Date.prototype.YYYYMMDDHHMMSS = () => {
  const yyyy = this.getFullYear().toString();
  const MM = pad(this.getMonth() + 1, 2);
  const dd = pad(this.getDate(), 2);
  const hh = pad(this.getHours(), 2);
  const mm = pad(this.getMinutes(), 2);
  const ss = pad(this.getSeconds(), 2);
  return yyyy + MM + dd + hh + mm + ss;
};

// check multiplication overflow: Returns true if overflow
const checkOverflow = (a, b) => {
  const c = a * b;
  return a !== c / b || b !== c / a;
};

// compute contract address from the sender's current nonce
const computeContractAddr = (sender) => {
  const userNonce = walletCtrl.getBalance(sender).nonce;
  const nonceStr = zilliqa.util.intToByteArray(userNonce, 64).join('');
  const digest = hashjs.sha256().update(sender).update(nonceStr).digest('hex');
  return digest.slice(24);
};

// compute transactionHash from the payload
const computeTransactionHash = (payload) => {
  // transactionID is a sha256 digest of txndetails
  const copyPayload = JSON.parse(JSON.stringify(payload));
  delete copyPayload.signature; // txn hash does not include signature
  const buf = Buffer.from(JSON.stringify(copyPayload));
  const transactionHash = hashjs
    .sha256()
    .update(buf)
    .digest('hex');
  return transactionHash;
};

// check for common elements within the list
const intersect = (a, b) => [...new Set(a)].filter(x => new Set(b).has(x));

// checks if the transactionJson is well-formed
const checkTransactionJson = (data) => {
  if (data !== null && typeof data !== 'object') return false;
  const payload = data[0];
  const expectedFields = [
    'version',
    'nonce',
    'to',
    'amount',
    'pubKey',
    'gasPrice',
    'gasLimit',
    'signature',
  ];

  /* Checking the keys in the payload */
  const numKeys = Object.keys(payload).length;
  if (numKeys < 8) return false;
  const payloadKeys = Object.keys(payload);
  const expected = intersect(payloadKeys, expectedFields).length;
  const actual = Object.keys(expectedFields).length;
  // number of overlap keys must be the same as the expected keys
  if (expected !== actual) return false;
  // validate signature - TODO

  return true;
};

module.exports = {

  /*
  * @params : data { Object } : Message object passed from client through server.js
  * @params: options { Object } : List of options passed from server.js
  * @returns: txnId { String } : Transaction hash
  * Throws in the event of error. Caller should catch or delegate these errors
  */

  processCreateTxn: async (data, options) => {
    logVerbose(logLabel, 'Processing transaction...');
    logVerbose(logLabel, `Payload well-formed? ${checkTransactionJson(data)}`);

    // Checks the wellformness of the transaction JSON data
    if (!checkTransactionJson(data)) {
      throw new Error('Invalid Tx Json');
    }

    const currentBNum = blockchain.getBlockNum();
    const dir = options.data_path;
    const payload = data[0];
    const senderAddress = zilliqa.util.getAddressFromPublicKey(payload.pubKey);

    logVerbose(logLabel, `Sender: ${senderAddress}`);
    const userNonce = walletCtrl.getBalance(senderAddress).nonce;
    logVerbose(logLabel, `User Nonce: ${userNonce}`);
    logVerbose(logLabel, `Payload Nonce: ${payload.nonce}`);

    // check if payload gasPrice is sufficient
    const blockchainGasPrice = config.blockchain.gasPrice;
    if (payload.gasPrice < blockchainGasPrice) {
      throw new Error(
        `Payload gas price is insufficient. Current gas price is ${
          config.blockchain.gasPrice
        }`,
      );
    }

    // check if the payload.nonce is valid
    if (payload.nonce === userNonce + 1) {
      // p2p token transfer
      if (!payload.code && !payload.data) {
        logVerbose(logLabel, 'p2p token tranfer');
        walletCtrl.deductFunds(
          senderAddress,
          payload.amount + payload.gasLimit,
        );
        walletCtrl.increaseNonce(senderAddress);
        walletCtrl.addFunds(payload.to, payload.amount);
      } else {
        /* contract generation */
        logVerbose(logLabel, 'Task: Contract Deployment / Create Transaction');
        // take the sha256 hash of address+nonce, then extract the rightmost 20 bytes
        const contractAddr = computeContractAddr(senderAddress);

        if (checkOverflow(payload.gasLimit, payload.gasPrice)) {
          throw new Error('Overflow detected: Invalid gas limit or gas price');
        }
        const gasLimitToZil = payload.gasLimit * payload.gasPrice;
        const gasAndAmount = payload.amount + gasLimitToZil;

        if (!walletCtrl.sufficientFunds(senderAddress, gasAndAmount)) {
          logVerbose(logLabel, 'Insufficient funds. Returning error to client.');
          throw new Error('Insufficient funds');
        }
        logVerbose(logLabel, `Contract will be deployed at: ${contractAddr}`);

        const responseData = await scillaCtrl.executeScillaRun(
          payload,
          contractAddr,
          dir,
          currentBNum,
          payload.gasLimit,
        );
        // Deduct funds
        const nextAddr = responseData.nextAddress;
        const gasConsumed = payload.gasLimit - responseData.gasRemaining;
        if (checkOverflow(gasConsumed, payload.gasPrice)) {
          throw new Error('Overflow detected: Invalid gas limit or gas price');
        }
        const gasConsumedInZil = gasConsumed * payload.gasPrice;

        walletCtrl.deductFunds(
          senderAddress,
          payload.amount + gasConsumedInZil,
        );
        walletCtrl.increaseNonce(senderAddress); // only increase if a contract is successful

        // FIXME: Support multicontract calls
        if (nextAddr !== '0'.repeat(40) && nextAddr.substring(2) !== senderAddress) {
          console.log('Multi-contract calls not supported.');
          throw new Error('Multi-contract calls are not supported yet.');
        }

        // Only update if it is a deployment call
        if (payload.code && payload.to === '0'.repeat(40)) {
          // Update address_to_contracts
          if (senderAddress in createdContractsByUsers) {
            logVerbose(logLabel, 'User has contracts. Appending to list');
            createdContractsByUsers[senderAddress].push(contractAddr);
          } else {
            logVerbose(logLabel, 'No existing contracts. Creating new entry.');
            createdContractsByUsers[senderAddress] = [contractAddr];
          }
          logVerbose(logLabel, `Addr-to-Contracts: ${createdContractsByUsers}`);
        }
      }
    } else {
      // payload.nonce is not valid. Deduct gas anyway
      // FIXME: Waiting for scilla interpreter to return a structured output
      // about out of gas errors
      // https://github.com/Zilliqa/scilla/issues/214

      walletCtrl.deductFunds(senderAddress, payload.gasLimit);
      logVerbose(logLabel, 'Invalid Nonce');
      throw new Error('Invalid Tx Json');
    }

    /*  Update Transactions */
    const txnId = computeTransactionHash(payload);
    logVerbose(logLabel, `Transaction will be logged as ${txnId}`);
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
    logVerbose(logLabel, 'State of blockchain:');
    transactions = data.transactions;
    logVerbose(logLabel, transactions);
  },

  processGetTransaction: (data) => {
    if (!data) {
      logVerbose(logLabel, 'Invalid params');
      const err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised',
      );
      throw err;
    }

    logVerbose(logLabel, `TxnID: ${data[0]}`);
    const res = transactions[data[0]];
    if (res) {
      return res;
    }
    throw new Error('Txn Hash not Present.');
  },

  processGetRecentTransactions: () => {
    logVerbose(logLabel, 'Getting Recent Transactions');

    const txnhashes = Object.keys(transactions);
    const responseObj = {};
    responseObj.TxnHashes = txnhashes.reverse();
    responseObj.number = txnhashes.length;
    return responseObj;
  },

  processGetSmartContractInit: (data, data_path) => {
    logVerbose(logLabel, 'Getting SmartContract Init');
    if (!data) {
      logVerbose(logLabel, 'Invalid params');
      const err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised',
      );
      throw err;
    }

    const contractAddress = data[0];
    if (contractAddress == null || !zilliqa.util.isAddress(contractAddress)) {
      consolePrint('Invalid request');
      throw new Error('Address size inappropriate');
    }

    const dir = data_path;
    const initFile = `${dir}${contractAddress.toUpperCase()}_init.json`;
    if (!fs.existsSync(initFile)) {
      consolePrint(`No init file found (Contract: ${contractAddress}`);
      throw new Error('Address does not exist');
    }
    const retMsg = JSON.parse(fs.readFileSync(initFile, 'utf-8'));
    return retMsg;
  },

  processGetSmartContractCode: (data, data_path) => {
    logVerbose(logLabel, 'Getting SmartContract code');
    if (!data) {
      logVerbose(logLabel, 'Invalid params');
      const err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised',
      );
      throw err;
    }

    const contractAddress = data[0];
    if (contractAddress == null || !zilliqa.util.isAddress(contractAddress)) {
      console.log('Invalid request');
      throw new Error('Address size inappropriate');
    }

    const codePath = `${data_path}${contractAddress.toUpperCase()}_code.scilla`;
    if (!fs.existsSync(codePath)) {
      console.log(`No code file found (Contract: ${contractAddress}`);
      throw new Error('Address does not exist');
    }
    logVerbose(logLabel, 'Returning smart contract code to caller.');
    const res = {};
    res.code = fs.readFileSync(codePath, 'utf-8');
    return res;
  },

  processGetSmartContractState: (data, data_path) => {
    logVerbose(logLabel, 'Getting SmartContract State');
    if (!data) {
      logVerbose(logLabel, 'Invalid params');
      const err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised',
      );
      throw err;
    }

    const contractAddress = data[0];
    if (contractAddress == null || !zilliqa.util.isAddress(contractAddress)) {
      console.log('Invalid request');
      throw new Error('Address size inappropriate');
    }

    const statePath = `${data_path}${contractAddress.toUpperCase()}_state.json`;
    if (!fs.existsSync(statePath)) {
      console.log(`No state file found (Contract: ${contractAddress}`);
      throw new Error('Address does not exist');
    }
    const retMsg = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    logVerbose(logLabel, retMsg);
    return retMsg;
  },

  /*
getSmartContracts: Returns the list of smart contracts created by an account
*/
  processGetSmartContracts: (data, data_path) => {
    if (!data) {
      logVerbose(logLabel, 'Invalid params');
      const err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised',
      );
      throw err;
    }

    const addr = data[0];
    console.log(`Getting smart contracts created by ${addr}`);
    if (addr == null || !zilliqa.util.isAddress(addr)) {
      console.log('Invalid request');
      throw new Error('Address size inappropriate');
    }

    const stateLists = [];
    if (!createdContractsByUsers[addr]) {
      throw new Error('Address does not exist');
    }
    // Addr found - proceed to append state to return list
    const contracts = createdContractsByUsers[addr];

    contracts.forEach((contractId) => {
      const statePath = `${data_path}${contractId.toUpperCase()}_state.json`;
      if (!fs.existsSync(statePath)) {
        console.log(`No state file found (Contract: ${contractId}`);
        throw new Error('Address does not exist');
      }
      const retMsg = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      const contractStateObj = {};
      contractStateObj.address = contractId;
      contractStateObj.state = retMsg;
      stateLists.push(contractStateObj);
    });

    return stateLists;
  },
};

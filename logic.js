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
const BN = require('bn.js');
const { Zilliqa } = require('zilliqa-js');
const scillaCtrl = require('./components/scilla/scilla');
const walletCtrl = require('./components/wallet/wallet');
const blockchain = require('./components/blockchain');
const { logVerbose, consolePrint } = require('./utilities');
const config = require('./config');

const logLabel = ('Logic.js');

// non-persistent states. Initializes whenever server starts
let transactions = {};
let createdContractsByUsers = {}; // address => contract addresses

/*  Dummy constructor for zilliqajs */
// @dev: Will be replaced once zilliqa-js exposes utils without constructors
const zilliqa = new Zilliqa({
  nodeUrl: 'http://localhost:8888',
});

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

  // `amount` must be a string after zilliqa-js 0.2.0
  // FIXME: Enable checks after release of zilliqa-js 0.2.0
  // if(typeof(payload['amount']) === 'number') {
  //   console.log(`[DEPRECATION NOTICE] Please upgrade your zilliqa-js`);
  //   return false;
  // }

  // number of overlap keys must be the same as the expected keys
  if (expected !== actual) return false;
  // validate signature - TODO

  return true;
};

module.exports = {

  exportData: () => {
    const data = {};
    data.transactions = transactions;
    data.createdContractsByUsers = createdContractsByUsers;
    return data;
  },

  loadData: (txns, contractsByUsers) => {
    transactions = txns;
    createdContractsByUsers = contractsByUsers;
    logVerbose(logLabel, `Transactions and contract data loaded.`);
  },

  /**
  * Function that handles the create transaction requests
  * @param : data { Object } : Message object passed from client through server.js
  * @param: options { Object } : List of options passed from server.js
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
    const dir = options.dataPath;
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

    const transferTransactionCost = config.blockchain.transferGasCost * config.blockchain.gasPrice;

    if (payload.nonce !== userNonce + 1) {
      // payload.nonce is not valid. Deduct gas anyway
      // FIXME: Waiting for scilla interpreter to return a structured output
      // about out of gas errors
      // https://github.com/Zilliqa/scilla/issues/214
      walletCtrl.deductFunds(senderAddress, transferTransactionCost);
      logVerbose(logLabel, 'Invalid Nonce');
      throw new Error('Invalid Tx Json');
    }

    if (!payload.code && !payload.data) {
       // p2p token transfer
      logVerbose(logLabel, 'p2p token tranfer');
      const bnAmount = new BN(payload.amount); 
      const bnTxFee = new BN(transferTransactionCost);
      const totalSum = bnAmount.add(bnTxFee).toNumber();
      walletCtrl.deductFunds(senderAddress, totalSum);
      walletCtrl.increaseNonce(senderAddress);
      walletCtrl.addFunds(payload.to.toLowerCase(), payload.amount);
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

  /*
  * Function to process GetSmartContract's state, init or code
  * @params : { String } : enum of either data, init or state
  */
  processGetDataFromContract: (data, dataPath, type) => {

    const fileType = type.trim().toLowerCase();
    if (!['init', 'state', 'code'].includes(fileType)) {
      throw new Error('Invalid option flag');
    }
    const ext = fileType === 'code' ? 'scilla' : 'json';
    logVerbose(logLabel, `Getting SmartContract ${fileType}`);

    if (!data) {
      logVerbose(logLabel, 'Invalid params');
      throw new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised',
      );
    }

    // checking contract address's validity
    const contractAddress = data[0];
    if (contractAddress == null || !zilliqa.util.isAddress(contractAddress)) {
      consolePrint('Invalid request');
      throw new Error('Address size inappropriate');
    }
    const filePath = `${dataPath}${contractAddress.toUpperCase()}_${fileType}.${ext}`;
    logVerbose(logLabel, `Retrieving data from ${filePath}`);

    if (!fs.existsSync(filePath)) {
      consolePrint(`No ${type} file found (Contract: ${contractAddress}`);
      throw new Error('Address does not exist');
    }

    const responseData = fs.readFileSync(filePath, 'utf-8');
    if (fileType === 'code') {
      return { code: responseData };
    }
    // handles init and state json after parsing
    return JSON.parse(responseData);
  },

  /*
    Function returns the list of smart contracts created by an account
  */
  processGetSmartContracts: (data, dataPath) => {
    if (!data) {
      logVerbose(logLabel, 'Invalid params');
      const err = new Error(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised',
      );
      throw err;
    }

    const addr = data[0].toLowerCase();
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
      const statePath = `${dataPath}${contractId.toUpperCase()}_state.json`;
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

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
const zCrypto = require('@zilliqa-js/crypto');
const zUtils = require('@zilliqa-js/util')

const { bytes } = require('@zilliqa-js/util');
const scillaCtrl = require('./components/scilla/scilla');
const walletCtrl = require('./components/wallet/wallet');
const blockchain = require('./components/blockchain');
const { logVerbose, consolePrint } = require('./utilities');
const config = require('./config');

const logLabel = ('Logic.js');

// non-persistent states. Initializes whenever server starts
let transactions = {};
let createdContractsByUsers = {}; // address => contract addresses

// check multiplication overflow: Returns true if overflow
const checkOverflow = (a, b) => {
  // @FIXME: Add check multiplication overflow logic
  return false;
};

// compute contract address from the sender's current nonce
const computeContractAddr = (senderAddr) => {

  const userNonce = walletCtrl.getBalance(senderAddr).nonce;
  return hashjs.sha256().
    update(senderAddr, 'hex').
    update(bytes.intToHexArray(userNonce, 16).join(''), 'hex')
    .digest('hex')
    .slice(24);
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
    'toAddr',
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
    const senderAddress = zCrypto.getAddressFromPublicKey(payload.pubKey);

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

    responseObj = {};
    const bnAmount = new BN(payload.amount);
    console.log(payload.gasLimit);
    const bnGasLimit = new BN(payload.gasLimit);
    const bnGasPrice = new BN(payload.gasPrice)

    if (!payload.code && !payload.data) {
      // p2p token transfer
      logVerbose(logLabel, 'p2p token tranfer');
      ;
      const bnTxFee = new BN(transferTransactionCost);
      const totalSum = bnAmount.add(bnTxFee).toNumber();
      walletCtrl.deductFunds(senderAddress, totalSum);
      walletCtrl.increaseNonce(senderAddress);
      walletCtrl.addFunds(payload.toAddr.toLowerCase(), payload.amount);
      responseObj.Info = 'Non-contract txn, sent to shard';
    } else {
      /* contract creation / invoke transition */
      logVerbose(logLabel, 'Task: Contract Deployment / Create Transaction');
      // take the sha256 hash of address+nonce, then extract the rightmost 20 bytes
      const contractAddr = computeContractAddr(senderAddress);
      if (checkOverflow(payload.gasLimit, payload.gasPrice)) {
        console.log('overflow detected')
        throw new Error('Overflow detected: Invalid gas limit or gas price');
      }

      console.log('Checking types');
      console.log(bnGasPrice.toNumber());
      console.log(bnGasLimit.toNumber());

      // User should have sufficient zils to pay for the gas
      const gasLimitToZil = bnGasLimit.mul(bnGasPrice);
      const gasAndAmount = bnAmount.add(gasLimitToZil);
      console.log(`Checking funds: ${gasAndAmount.toNumber()}`);

      if (!walletCtrl.sufficientFunds(senderAddress, gasAndAmount.toNumber())) {
        logVerbose(logLabel, 'Insufficient funds. Returning error to client.');
        throw new Error('Insufficient funds');
      }
      logVerbose(logLabel, 'Running scilla interpreter now')

      const responseData = await scillaCtrl.executeScillaRun(
        payload,
        contractAddr,
        dir,
        currentBNum,
        bnGasLimit.toNumber()
      );
      logVerbose(logLabel, 'Scilla interpreter completed');
      // Deduct funds
      const nextAddr = responseData.nextAddress;
      console.log(responseData);
      const bnGasRemaining = new BN(responseData.gasRemaining);
      const bnGasConsumed = bnGasLimit.sub(bnGasRemaining);
      if (checkOverflow(bnGasConsumed.toNumber(), payload.gasPrice)) {
        throw new Error('Overflow detected: Invalid gas limit or gas price');
      }
      const gasConsumedInZil = bnGasPrice.mul(bnGasConsumed).toNumber();

      walletCtrl.deductFunds(
        senderAddress,
        payload.amount + gasConsumedInZil,
      );
      walletCtrl.increaseNonce(senderAddress); // only increase if a contract is successful

      // FIXME: Support multicontract calls
      if (nextAddr !== '0'.repeat(40) && nextAddr.substring(2) !== senderAddress) {
        // Msg: Contract Txn, Sent To Ds
        console.log('Multi-contract calls not supported.');
        throw new Error('Multi-contract calls are not supported yet.');
      }

      // Only update if it is a deployment call
      if (payload.code && payload.toAddr === '0'.repeat(40)) {
        logVerbose(logLabel, `Contract deployed at: ${contractAddr}`);
        responseObj.Info = 'Contract Creation txn, sent to shard';
        responseObj.ContractAddress = contractAddr;


        // Update address_to_contracts
        if (senderAddress in createdContractsByUsers) {
          logVerbose(logLabel, 'User has contracts. Appending to list');
          createdContractsByUsers[senderAddress].push(contractAddr);
        } else {
          logVerbose(logLabel, 'No existing contracts. Creating new entry.');
          createdContractsByUsers[senderAddress] = [contractAddr];
        }
        logVerbose(logLabel, `Addr-to-Contracts: ${createdContractsByUsers}`);
      } else {
        // Placeholder msg - since there's no shards in Kaya RPC
        responseObj.Info = 'Contract Txn, Shards Match of the sender and receiver';
      }
    }


    /*  Update Transactions */
    const txnId = computeTransactionHash(payload);
    logVerbose(logLabel, `Transaction will be logged as ${txnId}`);
    recInfo = {};
    recInfo.cumulative_gas = 1;
    recInfo.success = true;

    const txnDetails = {
      ID: txnId,
      amount: payload.amount,
      nonce: payload.nonce,
      receipt: recInfo,
      senderPubKey: payload.pubKey,
      signature: payload.signature,
      toAddr: payload.toAddr,
      version: payload.version,
    };
    transactions[txnId] = txnDetails;
    responseObj.TranID = txnId;
    return responseObj;
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
    if (contractAddress == null || !zUtils.validation.isAddress(contractAddress)) {
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
    logVerbose(`Getting smart contracts created by ${addr}`);
    if (addr == null || !zUtils.validation.isAddress(addr)) {
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

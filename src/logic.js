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
const zUtils = require('@zilliqa-js/util');
const { bytes } = require('@zilliqa-js/util');
const zAccount = require('@zilliqa-js/account');
const scillaCtrl = require('./components/scilla/scilla');
const walletCtrl = require('./components/wallet/wallet');
const blockchain = require('./components/blockchain');
const { InterpreterError, BalanceError, MultiContractError, RPCError } = require('./components/CustomErrors');
const { logVerbose, consolePrint } = require('./utilities');
const config = require('./config');
const logLabel = ('Logic.js');
const zCore = require('@zilliqa-js/core')
const errorCodes = zCore.RPCErrorCode;

// non-persistent states. Initializes whenever server starts
const transactions = {};
const createdContractsByUsers = {}; // address => contract addresses
const contractAddressesByTransactionID = {};  // transaction hash => contract address

/**
 * computes the contract address from the sender's address and nonce
 * @method computeContractAddr
 * @param { String } senderAddr 
 * @returns { String } contract address to be deployed
 */
const computeContractAddr = (senderAddr) => {
  const userNonce = walletCtrl.getBalance(senderAddr).nonce;
  return hashjs.sha256().
    update(senderAddr, 'hex').
    update(bytes.intToHexArray(userNonce, 16).join(''), 'hex')
    .digest('hex')
    .slice(24);
};

/**
 * Confirms the transaction by logging it
 * @method logTransaction
 * @param { Object } payload - payload of the incoming message
 * @param { String } transactionID - transaction ID
 * @param { Object } receiptInfo - information about gas and if the transaction is confirmed
 * Does not return any message
 */

const logTransaction = (payload, transactionID, receiptInfo) => {

  const txnDetails = {
    ID: transactionID,
    amount: payload.amount,
    nonce: payload.nonce,
    receipt: receiptInfo,
    senderPubKey: payload.pubKey,
    signature: payload.signature,
    toAddr: payload.toAddr,
    version: payload.version,
  };
  transactions[transactionID] = txnDetails;
  logVerbose(logLabel, `Transaction logged: ${transactionID}`)

}

/**
 * 
 * Computes the transaction hash from a given payload
 * @method computeTransactionHash
 * @param { Object } payload : Payload of the message
 */
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

/**
 * Checks the transaction payload to make sure that it is well-formed
 * @method checkTransactionJson
 * @param { Object} data : Payload retrieved from message
 * @returns { Boolean } : True if the payload is valid, false if it is not
 */
const checkTransactionJson = (data) => {
  if (data !== null && typeof data !== 'object') return false;
  const payload = data[0];
  return zAccount.util.isTxParams(payload);
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
  * @async
  * @method processCreateTxn
  * @param { Object } data : Message object passed from client through server.js
  * @param { Object } options : List of options passed from server.js
  * @returns { String } : Transaction hash 
  * Throws in the event of error. Caller should catch or delegate these errors
  */
  processCreateTxn: async (data, options) => {
    logVerbose(logLabel, 'Processing transaction...');
    logVerbose(logLabel, `Payload well-formed? ${checkTransactionJson(data)}`);

    // Checks the wellformness of the transaction JSON data
    if (!checkTransactionJson(data)) {
      throw new Error('Invalid Tx Json');
    }

    let responseObj = {};

    const currentBNum = blockchain.getBlockNum();
    const dir = options.dataPath;

    // Getting data from payload
    const payload = data[0];
    const bnAmount = new BN(payload.amount);
    const bnGasLimit = new BN(payload.gasLimit);
    const bnGasPrice = new BN(payload.gasPrice);
    const bnInvokeGas = new BN(config.constants.gas.CONTRACT_INVOKE_GAS)
    const deductableZils = bnInvokeGas.mul(bnGasPrice);
    const senderAddress = zCrypto.getAddressFromPublicKey(payload.pubKey);
    const txnId = computeTransactionHash(payload);

    logVerbose(logLabel, `Sender: ${senderAddress}`);
    const userNonce = walletCtrl.getBalance(senderAddress).nonce;
    logVerbose(logLabel, `User Nonce: ${userNonce}`);
    logVerbose(logLabel, `Payload Nonce: ${payload.nonce}`);

    let receiptInfo = {};

    try {

      if (payload.nonce !== userNonce + 1) {
        throw new BalanceError('Nonce incorrect');
      }
      // check if payload gasPrice is sufficient
      const bnBlockchainGasPrice = new BN(config.blockchain.minimumGasPrice);
      console.log(bnBlockchainGasPrice.toString());
      console.log(bnGasPrice.toString());
      if (bnBlockchainGasPrice.gt(bnGasPrice)) {
        throw new BalanceError('Insufficient Gas Price')
      }

      if (!payload.code && !payload.data) {
        // p2p token transfer
        logVerbose(logLabel, 'Transaction Type: P2P Transfer (Type 1)');
        const bnTransferGas = new BN(config.constants.gas.NORMAL_TRAN_GAS);
        const bnTransferCostInZils = bnTransferGas.mul(bnGasPrice);
        const totalSum = bnAmount.add(bnTransferCostInZils);
        walletCtrl.deductFunds(senderAddress, totalSum);
        walletCtrl.increaseNonce(senderAddress);
        walletCtrl.addFunds(payload.toAddr.toLowerCase(), bnAmount);
        responseObj.Info = 'Non-contract txn, sent to shard';
        receiptInfo.cumulative_gas = bnTransferGas.toString();
        receiptInfo.success = true;
      } else {
        /* contract creation / invoke transition */
        logVerbose(logLabel, 'Task: Contract Deployment / Create Transaction');
        // take the sha256 hash of address+nonce, then extract the rightmost 20 bytes
        const contractAddr = computeContractAddr(senderAddress);

        // Before the scilla interpreter runs, address should have sufficient zils to pay for gasLimit + amount
        const bnGasLimitInZils = bnGasLimit.mul(bnGasPrice);
        const bnAmountRequiredForTx = bnAmount.add(bnGasLimitInZils);

        if (!walletCtrl.sufficientFunds(senderAddress, bnAmountRequiredForTx)) {
          logVerbose(logLabel, 'Insufficient funds. Returning error to client.');
          throw new BalanceError('Insufficient balance to process transction');
        }

        logVerbose(logLabel, 'Running scilla interpreter now');
        walletCtrl.increaseNonce(senderAddress);  // Always increase nonce whenever the interpreter is run
        // Interpreter can throw an InterpreterError
        const responseData = await scillaCtrl.executeScillaRun(
          payload,
          contractAddr,
          senderAddress,
          dir,
          currentBNum
        );
        logVerbose(logLabel, 'Scilla interpreter completed');

        const nextAddr = responseData.nextAddress;
        const bnGasRemaining = new BN(responseData.gasRemaining);
        const bnGasConsumed = bnGasLimit.sub(bnGasRemaining);
        const gasConsumedInZil = bnGasPrice.mul(bnGasConsumed);
        const deductableAmount = gasConsumedInZil.add(bnAmount);
        logVerbose(logLabel, `Gas Consumed in Zils ${gasConsumedInZil.toString()}`);
        logVerbose(logLabel, `Gas Consumed: ${bnGasConsumed.toString()}`);
        walletCtrl.deductFunds(senderAddress, deductableAmount);

        // FIXME: Support multicontract calls
        if (nextAddr !== '0'.repeat(40) && nextAddr.substring(2) !== senderAddress) {
          throw new MultiContractError('Multi-contract calls are not supported yet.');
        }

        const isDeployment = payload.code && payload.toAddr === '0'.repeat(40);
        // Only update if it is a deployment call
        if (isDeployment) {
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

          contractAddressesByTransactionID[txnId] = contractAddr;
          logVerbose(logLabel, `TransID: ${txnId} => Contract Address: ${contractAddr}`);
        } else {
          // Placeholder msg - since there's no shards in Kaya RPC
          responseObj.Info = 'Contract Txn, Shards Match of the sender and receiver';
        }

        receiptInfo.cumulative_gas = bnGasConsumed.toString();
        receiptInfo.success = true;
      }

      // Confirms transaction by storing the transaction object in-memory
      logTransaction(payload, txnId, receiptInfo);
      logVerbose(logLabel, `Transaction confirmed by the blockchain`);

    } catch (err) {
      logVerbose(logLabel, 'Transaction is NOT accepted by the blockchain');

      // Incorrect Balance (Amt, Nonce) does NOT increase the nonce value
      if (err instanceof BalanceError) {
        console.log(`Balance Error: ${err.message}`);
        walletCtrl.deductFunds(senderAddress, deductableZils);
      } else if (err instanceof InterpreterError) {
        // Note: Core zilliqa current deducts based on the CONSTANT.XML file config
        console.log('Scilla run is not successful.');
        // Deducts the amount of gas as specified in the config.constants settings
        walletCtrl.deductFunds(senderAddress, deductableZils);
        receiptInfo = {};
        receiptInfo.cumulative_gas = bnInvokeGas.toString();
        receiptInfo.success = false;
        logTransaction(payload, txnId, receiptInfo);
        logVerbose(logLabel, `Transaction is logged but it is not accepted due to scilla errors.`);
      } else if (err instanceof MultiContractError) {
        // Msg: Contract Txn, Sent To Ds
        console.log('Multi-contract calls not supported.');
        responseObj.Info = 'Contract Txn, Sent To Ds';
        // Do not deduct gas for the time being
      } else {
        // Propagate uncaught error to client
        console.log(`Uncaught error`);
        console.log(err);
        throw err;
      }
    } finally {
      // Returns output to caller
      logVerbose(logLabel, `Returning transactionID to user: ${txnId}`);
      responseObj.TranID = txnId;
      return responseObj;
    }
  },

  /**
   * Given a payload, returns the Transaction object if found
   * Throws if the payload is invalid
   * @method processGetTransaction
   * @param { Object } data - payload object
   */

  processGetTransaction: (data) => {
    if (!data) {
      logVerbose(logLabel, 'Invalid params');
      const err = new RPCError(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised: Size not appropriate',
        errorCodes.RPC_INVALID_PARAMS,
        null
      );
      throw err;
    }

    logVerbose(logLabel, `TxnID: ${data[0]}`);
    const res = transactions[data[0]];
    if (res) {
      return res;
    }
    const err = new RPCError(
      'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised: Size not appropriate',
      errorCodes.RPC_DATABASE_ERROR,
      null
    );
    throw err;
  },

  /**
   * Retrieves the last 100 transaction hash
   * @method processGetRecentTransactions
   * @returns { Object } - 100 transaction hashes
   */

  processGetRecentTransactions: () => {
    logVerbose(logLabel, 'Getting Recent Transactions');

    const txnhashes = Object.keys(transactions);
    const responseObj = {};
    responseObj.TxnHashes = txnhashes.reverse();
    responseObj.number = txnhashes.length;
    return responseObj;
  },

  /**
   * Function to process GetSmartContract's state, init or code
   * @param { Object } data : data retrieved from payload
   * @param { String } dataPath : datapath where the state file is stored
   * @param { String } type - enum of either data, init or state
   */
  processGetDataFromContract: (data, dataPath, type) => {

    const fileType = type.trim().toLowerCase();
    if (!['init', 'state', 'code'].includes(fileType)) {
      const err = new RPCError(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised: Invalid options flag',
        errorCodes.RPC_INVALID_PARAMS,
        null
      );
      throw err;
    }
    const ext = fileType === 'code' ? 'scilla' : 'json';
    logVerbose(logLabel, `Getting SmartContract ${fileType}`);

    if (!data) {
      logVerbose(logLabel, 'Invalid params');
      const err = new RPCError(
        'INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised: Size not appropriate',
        errorCodes.RPC_INVALID_PARAMS,
        null
      );
      throw err;
    }

    // checking contract address's validity
    const contractAddress = data[0];
    if (contractAddress == null || !zUtils.validation.isAddress(contractAddress)) {
      consolePrint('Invalid request');
      throw new RPCError('Address size not appropriate', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }
    const filePath = `${dataPath}${contractAddress.toLowerCase()}_${fileType}.${ext}`;
    logVerbose(logLabel, `Retrieving data from ${filePath}`);

    if (!fs.existsSync(filePath)) {
      consolePrint(`No ${type} file found (Contract: ${contractAddress}`);
      throw new RPCError('Address does not exist', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }

    const responseData = fs.readFileSync(filePath, 'utf-8');
    if (fileType === 'code') {
      return { code: responseData };
    }
    // handles init and state json after parsing
    return JSON.parse(responseData);
  },

  /**
   * Retrieves the smart contracts for a given address
   * @method processGetSmartContracts
   * @param { Object } data : data retrieved from payload
   * @param { String } dataPath : datapath where the state file is stored
   * @returns { Object } : All the state for contracts deployed by the address
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
    logVerbose(logLabel, `Getting smart contracts created by ${addr}`);
    if (addr === null || !zUtils.validation.isAddress(addr)) {
      console.log('Invalid request');
      throw new RPCError('Address size not appropriate', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }

    const stateLists = [];
    if (!createdContractsByUsers[addr]) {
      throw new RPCError('Address does not exist', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }
    // Addr found - proceed to append state to return list
    const contracts = createdContractsByUsers[addr];

    contracts.forEach((contractId) => {
      const statePath = `${dataPath}${contractId.toLowerCase()}_state.json`;
      if (!fs.existsSync(statePath)) {
        console.log(`No state file found (Contract: ${contractId}`);
        throw new RPCError('Address does not exist', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
      }
      const retMsg = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      const contractStateObj = {};
      contractStateObj.address = contractId;
      contractStateObj.state = retMsg;
      stateLists.push(contractStateObj);
    });

    return stateLists;
  },

  /**
   * Process Get Contract Address by Transaction ID
   * @method processGetContractAddressByTransactionID
   * @param { Object } data - data object of the payload which contrains transaction hash
   * @returns { String } contractAddress - 20 bytes string
   */
  processGetContractAddressByTransactionID: (data) => {
    if(typeof data === 'object' && data === null || data[0].length !== 64) {
      throw new RPCError('Size not appropriate', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }
    const transId = data[0];
    if(!transactions[transId]) {
      throw new Error("Txn Hash not Present");
    }

    const contractAddr = contractAddressesByTransactionID[transId];
    if(!contractAddr) { 
      throw new Error("ID not a contract txn");
    } else {
      return contractAddr;
    }
  }
};

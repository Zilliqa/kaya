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

// logic.js : Logic Script
const hashjs = require('hash.js');
const fs = require('fs');
const BN = require('bn.js');
const zCrypto = require('@zilliqa-js/crypto');
const zCore = require('@zilliqa-js/core');
const { bytes, validation } = require('@zilliqa-js/util');
const zAccount = require('@zilliqa-js/account');
const scillaCtrl = require('./components/scilla/scilla');
const walletCtrl = require('./components/wallet/wallet');
const blockchain = require('./components/blockchain');
const { InterpreterError, BalanceError, RPCError } = require('./components/CustomErrors');
const { logVerbose, consolePrint, isDeployContract } = require('./utilities');
const config = require('./config');

const logLabel = ('LOGIC');

const errorCodes = zCore.RPCErrorCode;

// non-persistent states. Initializes whenever server starts
let transactions = {};
let createdContractsByUsers = {}; // address => contract addresses
const contractAddressesByTransactionID = {}; // transaction hash => contract address

/**
 * computes the contract address from the sender's address and nonce
 * @method computeContractAddr
 * @param { String } senderAddr
 * @returns { String } contract address to be deployed
 */
const computeContractAddr = (senderAddr) => {
  const userNonce = walletCtrl.getBalance(senderAddr).nonce;
  return hashjs.sha256()
    .update(senderAddr, 'hex')
    .update(bytes.intToHexArray(userNonce, 16).join(''), 'hex')
    .digest('hex')
    .slice(24);
};

/**
 * Confirms the transaction by logging it
 * @method confirmTransaction
 * @param { Object } payload - payload of the incoming message
 * @param { String } transactionID - transaction ID
 * @param { Object } receiptInfo - information about gas and if the transaction is confirmed
 * Does not return any message
 */

const confirmTransaction = (payload, transactionID, receiptInfo) => {
  const txnDetails = {
    ID: transactionID,
    amount: payload.amount,
    gasLimit: payload.gasLimit,
    gasPrice: payload.gasPrice,
    nonce: payload.nonce,
    receipt: receiptInfo,
    senderPubKey: "0x".concat(payload.pubKey),
    signature: "0x".concat(payload.signature),
    toAddr: payload.toAddr.replace('0x', ''),
    version: payload.version,
  };
  transactions[transactionID] = txnDetails;
  logVerbose(logLabel, `Transaction logged: ${transactionID}`);
};

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
  const CHAIN_ID = config.chainId;
  const MSG_VERSION = config.msgVersion;
  const EXPECTED_VERSION = bytes.pack(CHAIN_ID, MSG_VERSION);

  if (data !== null && typeof data !== 'object') return false;
  const payload = data[0];
  // User must supply the correct chain_id and msg_version
  if (payload.version !== EXPECTED_VERSION) {
    console.log('Error: Msg is not well-formed');
    console.log('Possible fix: Did you specify the correct chain Id and msg version?');
    return false;
  }
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
    logVerbose(logLabel, 'Transactions and contract data loaded.');
  },

  /**
  * Function that handles the create transaction requests
  * @async
  * @method processCreateTxn
  * @param { Object } data : Message object passed from client through server.js
  * @param { String } dataPath : datapath where the state file is stored
  * @returns { String } : Transaction hash
  * Throws in the event of error. Caller should catch or delegate these errors
  */
  processCreateTxn: async (data, dataPath) => {
    logVerbose(logLabel, 'Processing transaction...');
    const isPayloadWellformed = checkTransactionJson(data);
    logVerbose(logLabel, `Payload well-formed? ${isPayloadWellformed}`);

    // Checks the wellformness of the transaction JSON data
    if (!isPayloadWellformed) {
      throw new Error('Invalid Tx Json');
    }

    const responseObj = {};

    const currentBNum = blockchain.getBlockNum();

    // Getting data from payload
    const dataElement = data[0];
    const payload = {
      ...dataElement,
      amount: dataElement.amount.toString(), // BN - toJSON returns hex string
      gasLimit: dataElement.gasLimit.toString(), // Long - toJSON is not defined
      gasPrice: dataElement.gasPrice.toString(), // BN - toJSON returns hex string
    };
    const bnAmount = new BN(payload.amount);
    const bnGasLimit = new BN(payload.gasLimit);
    const bnGasPrice = new BN(payload.gasPrice);
    const bnInvokeGas = new BN(config.constants.gas.CONTRACT_INVOKE_GAS);
    const deductableZils = bnInvokeGas.mul(bnGasPrice);
    const senderAddress = zCrypto.getAddressFromPublicKey(payload.pubKey).replace('0x', '').toLowerCase();
    const txnId = computeTransactionHash(payload);

    logVerbose(logLabel, `Sender: ${senderAddress}`);
    const userNonce = walletCtrl.getBalance(senderAddress).nonce;
    logVerbose(logLabel, `User Nonce: ${userNonce}`);
    logVerbose(logLabel, `Payload Nonce: ${payload.nonce}`);

    let receiptInfo = {};

    // Backup account balances for discarding changes if the transaction fails.
    const accountBalances = Object.entries(walletCtrl.getAccounts())
      .map(([address, account]) => [address, account.amount]);

    try {
      if (payload.nonce !== userNonce + 1) {
        throw new BalanceError('Nonce incorrect');
      }
      // check if payload gasPrice is sufficient
      const bnBlockchainGasPrice = new BN(config.blockchain.minimumGasPrice);
      if (bnBlockchainGasPrice.gt(bnGasPrice)) {
        throw new BalanceError('Insufficient Gas Price');
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

        // Before the scilla interpreter runs
        // address should have sufficient zils to pay for gasLimit + amount
        const bnGasLimitInZils = bnGasLimit.mul(bnGasPrice);
        const bnAmountRequiredForTx = bnAmount.add(bnGasLimitInZils);

        if (!walletCtrl.sufficientFunds(senderAddress, bnAmountRequiredForTx)) {
          logVerbose(logLabel, 'Insufficient funds. Returning error to client.');
          throw new BalanceError('Insufficient balance to process transction');
        }

        logVerbose(logLabel, 'Running scilla interpreter now');

        let bnGasRemaining = bnGasLimit;
        const events = [];
        let callsLeft = config.constants.transactions.MAX_CONTRACT_EDGES + 1;
        const executeTransition = async (
          currentPayload, currentDeployedContractAddress, currentSenderAddress,
        ) => {
          if (callsLeft < 1) {
            throw new Error('Maximum contract edges reached, cannot call another contract');
          }
          if (bnGasRemaining.lt(new BN(0))) throw new Error('Not Enough Gas');

          const amount = new BN(currentPayload.amount || '0');
          const currentAddressUnprefixed = currentPayload.toAddr.replace('0x', '').toLowerCase();

          const responseData = await scillaCtrl.executeScillaRun(
            currentPayload,
            currentDeployedContractAddress,
            currentSenderAddress,
            dataPath,
            currentBNum,
          );

          if (currentDeployedContractAddress) {
            if (walletCtrl.sufficientFunds(currentSenderAddress, amount)) {
              logVerbose(logLabel, 'Sufficient funds to pay the gas price, but not enough for transfer the amount, creating contract and ignoring amount transfer');
              walletCtrl.transferFunds(
                currentSenderAddress,
                currentDeployedContractAddress,
                amount,
              );
            }
          } else if (responseData.accepted) {
            walletCtrl.transferFunds(currentSenderAddress, currentAddressUnprefixed, amount);
          }
          if (responseData.events) {
            events.push(...responseData.events);
          }
          callsLeft -= 1;
          bnGasRemaining = new BN(responseData.gasRemaining);

          for (const message of responseData.messages) {
            if (message._tag === undefined
              || message._amount === undefined
              || message._recipient === undefined
              || message.params === undefined
            ) {
              throw new Error('The message in the json output of the contract is corrupted');
            }

            const nextAddress = message._recipient;
            const nextAddressUnprefixed = nextAddress.replace('0x', '');

            const initPath = `${dataPath}${nextAddressUnprefixed}_init.json`;
            const codePath = `${dataPath}${nextAddressUnprefixed}_code.scilla`;
            const transferAmount = message._amount || '0';
            if (message._tag === '' || !fs.existsSync(initPath) || !fs.existsSync(codePath)) {
              walletCtrl.transferFunds(
                currentAddressUnprefixed,
                nextAddressUnprefixed,
                new BN(transferAmount),
              );
              continue;
            }

            await executeTransition(
              {
                toAddr: nextAddressUnprefixed,
                amount: transferAmount,
                gasLimit: bnGasRemaining.toString(10),
                data: JSON.stringify(message),
              },
              null,
              currentAddressUnprefixed.toLowerCase(),
            );
          }
        };

        const isDeployment = payload.code && payload.toAddr === '0x' + '0'.repeat(40);
        const deployedContractAddress = isDeployment ? computeContractAddr(senderAddress) : null;
        // Always increase nonce whenever the interpreter is run
        // Interpreter can throw an InterpreterError
        // if contract deployment, increase nonce after computeContractAddr
        walletCtrl.increaseNonce(senderAddress);
        await executeTransition(payload, deployedContractAddress, senderAddress);
        logVerbose(logLabel, 'Scilla interpreter completed');

        if (events.length) receiptInfo.event_logs = events;
        const bnGasConsumed = bnGasLimit.sub(bnGasRemaining);
        const gasConsumedInZil = bnGasPrice.mul(bnGasConsumed);
        logVerbose(logLabel, `Gas Consumed in Zils ${gasConsumedInZil.toString()}`);
        logVerbose(logLabel, `Gas Consumed: ${bnGasConsumed.toString()}`);
        walletCtrl.deductFunds(senderAddress.replace('0x', ''), gasConsumedInZil);

        // Only update if it is a deployment call
        if (isDeployment) {
          logVerbose(logLabel, `Contract deployed at: ${deployedContractAddress}`);
          responseObj.Info = 'Contract Creation txn, sent to shard';
          responseObj.ContractAddress = deployedContractAddress;

          // Update address_to_contracts
          if (senderAddress in createdContractsByUsers) {
            logVerbose(logLabel, 'User has contracts. Appending to list');
            createdContractsByUsers[senderAddress].push(deployedContractAddress);
          } else {
            logVerbose(logLabel, 'No existing contracts. Creating new entry.');
            createdContractsByUsers[senderAddress] = [deployedContractAddress];
          }

          contractAddressesByTransactionID[txnId] = deployedContractAddress;
          logVerbose(logLabel, `TransID: ${txnId} => Contract Address: ${deployedContractAddress}`);
        } else {
          // Placeholder msg - since there's no shards in Kaya RPC
          responseObj.Info = 'Contract Txn, Shards Match of the sender and receiver';
        }

        receiptInfo.cumulative_gas = bnGasConsumed.toString();
        receiptInfo.success = true;
      }

      // Confirms transaction by storing the transaction object in-memory
      confirmTransaction(payload, txnId, receiptInfo);
      logVerbose(logLabel, 'Transaction confirmed by the blockchain');
    } catch (err) {
      // Discard balance changes if transaction fails
      const accounts = walletCtrl.getAccounts();
      for (const [address, amount] of accountBalances) {
        accounts[address].amount = amount;
      }

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
        confirmTransaction(payload, txnId, receiptInfo);
        logVerbose(logLabel, 'Transaction is logged but it is not accepted due to scilla errors.');
      } else {
        // Propagate uncaught error to client
        console.log('Uncaught error');
        console.log(err);
        throw err;
      }
    } finally {
      // Returns output to caller
      logVerbose(logLabel, `Returning transactionID to user: ${txnId}`);
      responseObj.TranID = txnId;
    }
    return responseObj;
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
        null,
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
      null,
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
        null,
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
        null,
      );
      throw err;
    }

    // checking contract address's validity
    const contractAddress = data[0];
    if (contractAddress == null || !validation.isAddress(contractAddress)) {
      consolePrint('Invalid request');
      throw new RPCError('Address size not appropriate', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }
    const filePath = `${dataPath}${contractAddress.toLowerCase()}_${fileType}.${ext}`;
    logVerbose(logLabel, `Retrieving data from ${filePath}`);

    if (!fs.existsSync(filePath)) {
      consolePrint(`No ${type} file found (Contract: ${contractAddress}`);
      throw new RPCError('Address does not exist', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }

    let responseData = fs.readFileSync(filePath, 'utf-8');
    if (fileType === 'code') {
      return { code: responseData };
    }
    responseData = JSON.parse(responseData);

    if (fileType === 'state') {
      result = {};
      responseData.forEach(field => result[field.vname] = field.value);
      return result;
    }
    return responseData;
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
    if (addr === null || !validation.isAddress(addr)) {
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
    if ((typeof data === 'object' && data === null) || data[0].length !== 64) {
      throw new RPCError('Size not appropriate', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }
    const transId = data[0];
    if (!transactions[transId]) {
      throw new Error('Txn Hash not Present');
    }

    const contractAddr = contractAddressesByTransactionID[transId];
    if (!contractAddr) {
      throw new Error('ID not a contract txn');
    } else {
      return contractAddr;
    }
  },
};

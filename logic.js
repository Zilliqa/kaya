// logic.js : Logic Script
const sha256 = require("bcrypto").sha256;
const fs = require("fs");
const path = require("path");
const zilliqa_util = require("./lib/util");
const utilities = require("./utilities");
const scillaCtrl = require("./components/scilla/scilla");
const walletCtrl = require("./components/wallet/wallet");
const blockchain = require('./components/blockchain');

// debug usage: DEBUG=scilla-txn node server.js
var debug_txn = require("debug")("testrpc:logic");

// non-persistent states. Initializes whenever server starts
var repo = {};
var transactions = {};
var addr_to_contracts = {};
var map_Caddr_owner = {};

/* Utility functions */

function pad(number, length) {
  var str = "" + number;
  while (str.length < length) {
    str = "0" + str;
  }
  return str;
}

Date.prototype.YYYYMMDDHHMMSS = function () {
  var yyyy = this.getFullYear().toString();
  var MM = pad(this.getMonth() + 1, 2);
  var dd = pad(this.getDate(), 2);
  var hh = pad(this.getHours(), 2);
  var mm = pad(this.getMinutes(), 2);
  var ss = pad(this.getSeconds(), 2);

  return yyyy + MM + dd + hh + mm + ss;
};


module.exports = {
  processCreateTxn: (data, saveMode) => {
    debug_txn("Processing transaction...");

    let currentBNum = blockchain.getBlockNum();
    dir = "tmp/";
    if (saveMode) {
      console.log("Save mode enabled.");
      dir = "data/";
    }
    // todo: check for well-formness of the payload data
    let payload = data[0];
    let _sender = zilliqa_util.getAddressFromPublicKey(
      payload.pubKey.toString("hex")
    );
    debug_txn(`Sender: ${_sender}`);
    userNonce = walletCtrl.getBalance(_sender).nonce;
    debug_txn(`User Nonce: ${userNonce}`);
    debug_txn(`Payload Nonce: ${payload.nonce}`)

    // check if the payload.nonce is valid
    if (payload.nonce == userNonce + 1) {
      /* contract generation */
      // take the sha256 hash of address+nonce, then extract the rightmost 20 bytes
      let nonceStr = zilliqa_util
        .intToByteArray(payload.nonce - 1, 64)
        .join("");
      let combinedStr = _sender + nonceStr;
      let contractPubKey = sha256.digest(new Buffer(combinedStr, "hex"));
      const contractAddr = contractPubKey.toString("hex", 12);

      // @dev: currently, the gas cost is the gaslimit. This WILL change in the future
      if (
        !walletCtrl.sufficientFunds(_sender, payload.amount + payload.gasLimit)
      ) {
        debug_txn(`Insufficient funds. Returning error to client.`);
        throw new Error("Insufficient funds");
      }
      debug_txn(`Contract will be deployed at: ${contractAddr}`);

      nextAddr = scillaCtrl.executeScillaRun(payload, contractAddr, dir, currentBNum);
      //deduct funds
      walletCtrl.deductFunds(_sender, payload.amount + payload.gasLimit);
      walletCtrl.increaseNonce(_sender); // only increase if a contract is successful

      if (nextAddr.substring(2) != _sender) {
        console.log(
          `Contract is calling another address. This is not supported yet.`
        );
        //throw new Error(`Multi-contract calls are not supported yet.`)
      }

      // Only update if it is a deployment call
      if (payload.code && payload.to == '0000000000000000000000000000000000000000') {
        // Update address_to_contracts DS
        if (_sender in addr_to_contracts) {
          debug_txn("User has contracts. Appending to list");
          addr_to_contracts[_sender].push(contractAddr);
        } else {
          debug_txn("User do not have existing contracts. Creating new entry.");
          addr_to_contracts[_sender] = [contractAddr];
        }
        debug_txn("Addr-to-Contracts: %O", addr_to_contracts);

      }

    } else {
      // payload.nonce is not valid. Deduct gas anyway
      walletCtrl.deductFunds(_sender, payload.amount + payload.gasLimit);
      debug_txn("Invalid Nonce");
    }
    
    // transtionID is a sha256 digest of txndetails
    testID = Buffer.from(JSON.stringify(payload));
    newTransactionID = sha256.digest(testID).toString("hex");

    debug_txn(`Transaction will be logged as ${newTransactionID}`);
    let txnDetails = {
      version: payload.version,
      nonce: payload.nonce,
      to: payload.to,
      pubkey: payload.pubKey,
      ID: newTransactionID,
      from: _sender,
      amount: payload.amount
    };
    transactions[newTransactionID] = txnDetails;

    // return txnID to user
    return newTransactionID;
  },

  bootstrapFile: filepath => {
    //bootstraps state of transactions and caddr owner
    var data = JSON.parse(fs.readFileSync(filepath, "utf-8"));
    console.log("state of blockchain:");
    transactions = data.transactions;
    repo = data.repo;
    map_Caddr_owner = data.map_Caddr_owner;
    console.log(transactions);
  },

  dumpDataFiles: data => {
    // save the state of transactions
    var data = {};
    data.transactions = transactions;
    data.addr_to_contracts = addr_to_contracts;
    data.map_Caddr_owner = map_Caddr_owner;
    data.repo = repo;
    var d = new Date();
    save_filename = `data/save/${d.YYYYMMDDHHMMSS()}_blockchain_states.json`;
    console.log(`Save Mode Enabled: Files will be saved in ${save_filename}`);
    fs.writeFileSync(save_filename, JSON.stringify(data, "UTF-8"));
  },

  processGetTransaction: data => {
    if(!data) { 
      debug_txn('Invalid params')
      err = new Error('INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised');
      throw err;
    }

    debug_txn(`TxnID: ${data[0]}`);
    var data = transactions[data[0]];
    if (data) {
      return data;
    }
    throw new Error("Txn Hash not Present.");
  },

  processGetRecentTransactions: (data) => {
    console.log(`Getting Recent Transactions`);

    var txnhashes = Object.keys(transactions);
    var responseObj = {};
    responseObj.TxnHashes = txnhashes.reverse();
    responseObj.number = txnhashes.length;
    return responseObj;
  },

  processGetSmartContractInit: (data, saveMode) => {
    debug_txn(`Getting SmartContract Init`);
    if(!data) { 
      debug_txn('Invalid params')
      err = new Error('INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised');
      throw err;
    }


    contract_addr = data[0];
    if (contract_addr == null || !zilliqa_util.isAddress(contract_addr)) {
      console.log("Invalid request");
      throw new Error("Address size inappropriate");
    }

    dir = saveMode ? "data/" : "tmp/";
    var init_json = `${dir}${contract_addr.toLowerCase()}_init.json`;
    if (!fs.existsSync(init_json)) {
      console.log(`No init file found (Contract: ${contract_addr}`);
      throw new Error("Address does not exist");
    }
    var retMsg = JSON.parse(fs.readFileSync(init_json, "utf-8"));
    return retMsg;
  },

  processGetSmartContractCode: (data, saveMode) => {
    debug_txn(`Getting SmartContract code`);
    if(!data) { 
      debug_txn('Invalid params')
      err = new Error('INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised');
      throw err;
    }

    contract_addr = data[0];
    if (contract_addr == null || !zilliqa_util.isAddress(contract_addr)) {
      console.log("Invalid request");
      throw new Error("Address size inappropriate");
    }

    dir = saveMode ? "data/" : "tmp/";
    var code_path = `${dir}${contract_addr.toLowerCase()}_code.scilla`;
    if (!fs.existsSync(code_path)) {
      console.log(`No code file found (Contract: ${contract_addr}`);
      throw new Error("Address does not exist");
    }
    debug_txn('Returning smart contract code to caller.');
    data = {}
    data['code'] = fs.readFileSync(code_path, "utf-8");
    return data;
  },

  processGetSmartContractState: (data, saveMode) => {
    debug_txn(`Getting SmartContract State`);
    if(!data) { 
      debug_txn('Invalid params')
      err = new Error('INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised');
      throw err;
    }

    contract_addr = data[0];
    if (contract_addr == null || !zilliqa_util.isAddress(contract_addr)) {
      console.log("Invalid request");
      throw new Error("Address size inappropriate");
    }

    dir = saveMode ? "data/" : "tmp/";
    var state_json = `${dir}${contract_addr.toLowerCase()}_state.json`;
    if (!fs.existsSync(state_json)) {
      console.log(`No state file found (Contract: ${contract_addr}`);
      throw new Error("Address does not exist");
    }
    var retMsg = JSON.parse(fs.readFileSync(state_json, "utf-8"));
    console.log(retMsg);
    return retMsg;
  },

  /*
getSmartContracts: Returns the list of smart contracts created by 
an account
*/
  processGetSmartContracts: (data, saveMode) => {

    if(!data) { 
      debug_txn('Invalid params')
      err = new Error('INVALID_PARAMS: Invalid method parameters (invalid name and/or type) recognised');
      throw err;
    }

    let addr = data[0];
    console.log(`Getting smart contracts created by ${addr}`);
    if (addr == null || !zilliqa_util.isAddress(addr)) {
      console.log("Invalid request");
      throw new Error("Address size inappropriate");
    }

    var stateLists = [];
    if (!addr_to_contracts[addr]) {
      throw new Error("Address not found");
    }
    // Addr found - proceed to append state to return list
    dir = saveMode ? "data/" : "tmp/";
    contracts = addr_to_contracts[addr];
    for (var i in contracts) {
      contractID = contracts[i];

      var state_json = `${dir}${contractID.toLowerCase()}_state.json`;
      if (!fs.existsSync(state_json)) {
        console.log(`No state file found (Contract: ${contractID}`);
        throw new Error("Address does not exist");
      }
      var retMsg = JSON.parse(fs.readFileSync(state_json, "utf-8"));
      var data = {};
      data.address = contractID;
      data.state = retMsg;
      stateLists.push(data);
    }

    return stateLists;
  }
};

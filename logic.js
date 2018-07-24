// logic.js : Logic Script
const crypto = require('crypto');
const sha256 = require('bcrypto').sha256
const fs = require('fs');
const path = require('path');
const zilliqa_util = require('./lib/util')
const utilities = require('./utilities');
const scillaCtrl = require('./components/scilla/scilla');

// debug usage: DEBUG=scilla-txn node server.js
var debug_txn = require('debug')('testrpc:logic');


// non-persistent states. Initializes whenever server starts
var repo = {};
var transactions = {};
var addr_to_contracts = {};
var map_Caddr_owner = {};

/* Utility functions */

function pad(number, length) {
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}


Date.prototype.YYYYMMDDHHMMSS = function () {
    var yyyy = this.getFullYear().toString();
    var MM = pad(this.getMonth() + 1, 2);
    var dd = pad(this.getDate(), 2);
    var hh = pad(this.getHours(), 2);
    var mm = pad(this.getMinutes(), 2)
    var ss = pad(this.getSeconds(), 2)

    return yyyy + MM + dd + hh + mm + ss;
};

module.exports = {

    processCreateTxn: (data, saveMode) => {
        debug_txn('Processing transaction...');
        dir = 'tmp/'
        if (saveMode) {
            console.log('Save mode enabled.');
            dir = 'data/'
        }
        // todo: check for well-formness of the payload data
        let payload = data[0];
        let _sender = zilliqa_util.getAddressFromPublicKey(payload.pubKey.toString('hex'));
        debug_txn(`Sender: ${_sender}`);

        /* contract generation */
        // take the sha256 has of address+nonce, then extract the rightmost 20 bytes
        let nonceStr = zilliqa_util.intToByteArray(payload.nonce - 1, 64).join('');
        let combinedStr = _sender + nonceStr;
        let contractPubKey = sha256.digest(new Buffer(combinedStr, 'hex'));
        const contractAddr = contractPubKey.toString('hex', 12)
        console.log(contractAddr);

        debug_txn(`Contract will be deployed at: ${contractAddr}`);

        scillaCtrl.executeScillaRun(payload, contractAddr, dir);
        // After transaction is completed, assign transanctionID
        newTransactionID = crypto.randomBytes(32).toString('hex');
        debug_txn(`Transaction will be logged as ${newTransactionID}`);
        let txnDetails = {
            ID: newTransactionID,
            version: payload.version,
            nonce: payload.nonce,
            to: payload.to,
            from: _sender,
            amount: payload.amount,
            pubkey: payload.pubKey,
        };

        //transactions.push(txnDetails);
        transactions[newTransactionID] = txnDetails;

        // Update address_to_contracts DS
        if (_sender in addr_to_contracts) {
            debug_txn('User has contracts. Appending to list');
            addr_to_contracts[_sender].push(contractAddr);
        } else {
            debug_txn('Creating new entry.');
            addr_to_contracts[_sender] = [contractAddr];
        }
        debug_txn('Addr-to-Contracts: %O', addr_to_contracts);

        // return txnID to user
        return newTransactionID;

    },

    bootstrapFile: (filepath) => {
        //bootstraps state of transactions and caddr owner
        var data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        console.log('state of blockchain:');
        transactions = data.transactions;
        repo = data.repo;
        map_Caddr_owner = data.map_Caddr_owner;
        console.log(transactions);
    },

    dumpDataFiles: (data) => {
        // save the state of transactions
        var data = {};
        data.transactions = transactions;
        data.addr_to_contracts = addr_to_contracts;
        data.map_Caddr_owner = map_Caddr_owner;
        data.repo = repo;
        var d = new Date();
        save_filename = `data/save/${d.YYYYMMDDHHMMSS()}_blockchain_states.json`;
        console.log(`Save Mode Enabled: Files will be saved in ${save_filename}`);
        fs.writeFileSync(save_filename, JSON.stringify(data, 'UTF-8'));
    },

    processGetTransaction: (data) => {
        debug_txn(`TxnID: ${data[0]}`);
        var data = transactions[data[0]];
        if (data) {
            return data;
        }
        throw new Error('Txn Hash not Present.');
    },

    processGetRecentTransactions: (data) => {
        console.log(`Getting Recent Transactions`);
        var txnhashes = Object.keys(transactions);
        var responseObj = {};
        responseObj.TxnHashes = txnhashes.reverse();
        responseObj.number = txnhashes.length;
        return responseObj;
    },


    processGetSmartContractState: (data, saveMode) => {
        debug_txn(`Getting SmartContract State`);
        contract_addr = data[0];
        if (contract_addr == null || !zilliqa_util.isAddress(contract_addr)) {
            console.log('Invalid request');
            throw new Error('Address size inappropriate');
        }

        dir = (saveMode) ? 'data/' : 'tmp/';
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
        // todo: check for well-formness of the payload data


        let addr = data[0];
        console.log(`Getting smart contracts created by ${addr}`);
        if (addr == null || !zilliqa_util.isAddress(addr)) {
            console.log('Invalid request');
            throw new Error('Address size inappropriate');
        }

        var stateLists = [];
        if (!addr_to_contracts[addr]) {
            throw new Error('Address not found');
        }
        // Addr found - proceed to append state to return list
        dir = (saveMode) ? 'data/' : 'tmp/';
        contracts = addr_to_contracts[addr];
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
}
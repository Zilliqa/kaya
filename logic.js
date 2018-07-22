// logic.js : Logic Script
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zilliqa_util = require('./lib/util')
const utilities = require('./utilities');
const scillaCtrl = require('./components/scilla/scilla');

// debug usage: DEBUG=scilla-txn node server.js
var debug_txn = require('debug')('testrpc:logic');


// non-persistent states. Initializes whenever server starts
var repo = {};
var transactions = [];
var addr_to_contracts = {};
var map_Caddr_owner = {};

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

        // todo: change to a proper address generation design
        let newContract_addr = crypto.randomBytes(20).toString('hex');
        debug_txn(`Contract will be deployed at: ${newContract_addr}`);
        scillaCtrl.executeScillaRun(payload, newContract_addr, dir);

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

        transactions.push(txnDetails);
        //transactions[newTransactionID] = txnDetails;

        // Update address_to_contracts DS
        if(_sender in addr_to_contracts) { 
            debug_txn('User has contracts. Appending to list');
            addr_to_contracts[_sender].push(newContract_addr);
        }   else {
            debug_txn('Creating new entry.');
            addr_to_contracts[_sender] = [newContract_addr];
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
        return data;;
    },


    processGetSmartContractState: (data, saveMode) => {
        debug_txn(`Getting SmartContract State`);
        contract_addr = data[0];
        if(contract_addr == null || !zilliqa_util.isAddress(contract_addr)) { 
            console.log('Invalid request');
            throw new Error('Address size inappropriate');
        }

        dir = (saveMode) ? 'data/' : 'tmp/';
        var state_json = `${dir}${contract_addr.toLowerCase()}_state.json`;
        if(!fs.existsSync(state_json)) {
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
    processGetSmartContracts: (address) => {
        // todo: check for well-formness of the payload data
        let payload = data[0];
        let _sender = zilliqa_util.getAddressFromPublicKey(payload.pubKey.toString('hex'));
        debug_txn(`Sender: ${_sender}`);
    }
}
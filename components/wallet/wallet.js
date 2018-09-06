/**
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
**/

/* Wallet Component */
const assert = require('assert');
const config = require('../../config');
const {Zilliqa} = require('zilliqa-js');
const LOG_WALLET = require('debug')('kaya:wallet');

//@dev: As this is a kaya, private keys will be stored
// note: Real systems do not store private key

// Wallet will store three things - address, private key and balance
wallets = {};

/*  Dummy constructor for zilliqajs */
// @dev: Will be replaced once zilliqa-js exposes utils without constructors
let zilliqa = new Zilliqa({
    nodeUrl: 'http://localhost:8888'
});

// wrapper: print only when not in test mode
const console_print = (text) => { 
    if (process.env.NODE_ENV != 'test') {
        console.log(text);
    }
}

const createNewWallet = () => {
    let pk = zilliqa.util.generatePrivateKey();
    let address = zilliqa.util.getAddressFromPrivateKey(pk);
    let privKey_string = pk.toString('hex');
    newWallet = {
        privateKey: privKey_string,
        amount: config.wallet.defaultAmt,
        nonce: config.wallet.defaultNonce
    };
    wallets[address] = newWallet;
}


// validate an accounts object to check validity
const validateAccounts = (accounts) => { 

    Object.keys(accounts).forEach(function(key) {
        if(!zilliqa.util.isAddress(key)) { 
            throw new Error(`Invalid address ${key}`);
        }
        account = accounts[key];
        // check if account has the necessary properties
        if(!(
            account.hasOwnProperty('privateKey') && 
            account.hasOwnProperty('nonce') &&
            account.hasOwnProperty('amount')
        )) {
            throw new Error('Invalid fields');
        }

        let addressFromPK = zilliqa.util.getAddressFromPrivateKey(account.privateKey);
        if(addressFromPK != key) {
            LOG_WALLET('Validation failure: Invalid Address and Private key-pair')
            throw new Error(`Invalid address for ${key}`);
        }
        if(Number.isInteger(account['nonce']) && Number.isInteger(account['amount'])) {
            if(account['nonce'] < 0 || account['amount'] < 0) {
                throw new Error('Invalid nonce or amount');

            }
        } else {
            LOG_WALLET('Amount/nonce is not valid type')
            throw new Error('Invalid nonce or amount');

        };

    });
    LOG_WALLET('Valid accounts file');
    
}


module.exports = {
    createWallets: (n) => { 
        assert(n > 0);
        for(var i=0; i < n; i++){
            createNewWallet();
        }
    },

    // load accounts object into wallets
    loadAccounts: (accounts) => {
        validateAccounts(accounts);
        LOG_WALLET(`${Object.keys(accounts).length} wallets bootstrapped from file`)
        wallets = accounts;
    },

    getAccounts: () => {
        return wallets;
    },

    printWallet: () => {
        if(wallets.length == 0) { 
            console.log('No wallets generated.');
        } else {
            console_print('Available Accounts');
            console_print('=============================');
            keys = [];
            for(let i = 0; i< config.wallet.numAccounts; i++) {
                var addr = Object.keys(wallets)[i];
                console_print(`(${i}) ${addr} (Amt: ${wallets[addr].amount}) (Nonce: ${wallets[addr].nonce})`);
                keys.push(wallets[addr].privateKey);
            }
            console_print('\n Private Keys ');
            console_print('=============================');
            for(let i = 0; i < config.wallet.numAccounts; i++) { 
                console_print(`(${i}) ${keys[i]}`);
            }
        }
    },

    sufficientFunds: (address, amount) => {
        // checking if an address has sufficient funds for deduction
        userBalance = module.exports.getBalance(address);
        LOG_WALLET(`Checking if ${address} has ${amount}`);
        if(userBalance.balance < amount) {
            LOG_WALLET(`Insufficient funds.`);
            return false;
        } else {
            LOG_WALLET(`Sufficient Funds.`)
            return true;
        }
    },

    deductFunds: (address, amount) => {
        LOG_WALLET(`Deducting ${amount} from ${address}`);
        if(!zilliqa.util.isAddress(address)) { 
            throw new Error('Address size not appropriate');
        }       
        if(!wallets[address] || !module.exports.sufficientFunds(address, amount)) {
            throw new Error('Insufficient Funds');
        }
              
        // deduct funds
        let currentBalance = wallets[address].amount;
        LOG_WALLET(`Sender's previous Balance: ${currentBalance}`);
        currentBalance = currentBalance - amount;
        if(currentBalance < 0) { 
            throw new Error('Unexpected error, funds went below 0');
        }
        wallets[address].amount = currentBalance;
        LOG_WALLET(`Deduct funds complete. Sender's new balance: ${wallets[address].amount}`)
    },

    addFunds: (address, amount) => { 
        LOG_WALLET(`Adding ${amount} to ${address}`);
        if(!zilliqa.util.isAddress(address)) { 
            throw new Error('Address size not appropriate')
        } 
        if(!wallets[address]) { 
            // initialize new wallet account
            LOG_WALLET(`Creating new wallet account for ${address}`)
            wallets[address] = {};
            wallets[address].amount = 0;
            wallets[address].nonce = 0;
        }        
        let currentBalance = wallets[address].amount;
        LOG_WALLET(`Recipient's previous Balance: ${currentBalance}`);

        // add amount
        currentBalance = currentBalance + amount;
        wallets[address].amount = currentBalance;
        LOG_WALLET(`Adding funds complete. Recipient's new Balance: ${wallets[address].amount}`)
    },

    increaseNonce: (address) => { 
        LOG_WALLET(`Increasing nonce for ${address}`)
        if(!zilliqa.util.isAddress(address)) { 
            throw new Error('Address size not appropriate')
        }
        if(!wallets[address]) { 
            throw new Error('Address not found');
        } else {
            wallets[address].nonce = wallets[address].nonce + 1;
            LOG_WALLET(`New nonce for ${address} : ${wallets[address].nonce}`)
        }
    },

    getBalance: (address) => {
        // if(!zilliqa.util.isAddress(address)) { 
        //     throw new Error('Address size not appropriate')
        // }
        LOG_WALLET(`Getting balance for ${address}`);

        if(!wallets[address]) { 
            return {balance: 0, nonce: 0};
        } else {
            return {balance: wallets[address].amount,
                nonce: wallets[address].nonce}
        }
    }


}
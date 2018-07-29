/* Wallet Component */
const crypto = require('crypto');
const assert = require('assert');
const zilliqa_util = require('../../lib/util')
let colors = require('colors');
var debug_wallet = require('debug')('testrpc:wallet');


//@dev: As this is a testrpc, private keys will be stored

// Wallet will store three things - address, private key and balance
wallets = {};

function createNewWallet() {
    let pk = zilliqa_util.generatePrivateKey();
    let address = zilliqa_util.getAddressFromPrivateKey(pk);
    let privKey_string = pk.toString('hex');
    let amt = 100000;
    newWallet = {
        privateKey: privKey_string,
        amount: amt,
        nonce: 0
    };
    wallets[address] = newWallet;
}

module.exports = {
    createWallets: (n) => { 
        assert(n > 0);
        for(var i=0; i < n; i++){
            createNewWallet();
        }
    },

    printWallet: () => {
        if(wallets.length == 0) { 
            console.log('No wallets generated.');
        } else {
            console.log('Available Accounts');
            console.log('=============================');
            keys = [];
            for(let i = 0; i<10; i++) {
                var addr = Object.keys(wallets)[i];
                console.log(`(${i}) ${addr} (Amt: ${wallets[addr].amount}) (Nonce: ${wallets[addr].nonce})`);
                keys.push(wallets[addr].privateKey);
            }
    
            console.log('\n Private Keys ');
            console.log('=============================');
            for(let i = 0; i < 10; i++) { 
                console.log(`(${i}) ${keys[i]}`);
            }
        }
    },

    sufficientFunds: (address, amount) => {
        // checking if an address has sufficient funds for deduction
        userBalance = module.exports.getBalance(address);
        debug_wallet(`Checking if ${address} has ${amount}`)
        if(userBalance.balance < amount) {
            debug_wallet(`Insufficient funds.`);
            return false;
        } else {
            debug_wallet(`Sufficient Funds.`)
            return true;
        }
    },

    deductFunds: (address, amount) => {
        debug_wallet(`Deducting ${amount} from ${address}`);
        console.log(module.exports.getBalance(address));
        
        assert(module.exports.sufficientFunds(address, amount));

        // deduct funds
        let currentBalance = wallets[address].amount;
        debug_wallet(`Current Balance: ${currentBalance}`);
        currentBalance = currentBalance - amount;
        if(currentBalance < 0) { 
            throw new Error('Unexpected error, funds went below 0');
        }
        wallets[address].amount = currentBalance;
        debug_wallet(`Deduct funds complete. New Balance: ${wallets[address].amount}`)
    },

    increaseNonce: (address) => { 
        debug_wallet(`Increasing nonce for ${address}`)
        if(!zilliqa_util.isAddress(address)) { 
            throw new Error('Address size not appropriate')
        }
        if(!wallets[address]) { 
            // on zilliqa, default balance and nonce is 0
            // however, since im only storing wallets that have been created, i will throw error instead of increasing dummy nonce.
            throw new Error('Address not found');
        } else {
            wallets[address].nonce = wallets[address].nonce + 1;
            debug_wallet(`New nonce for ${address} : ${wallets[address].nonce}`)
        }
    },

    getBalance: (address) => { 
        if(!zilliqa_util.isAddress(address)) { 
            throw new Error('Address size not appropriate')
        }
        if(!wallets[address]) { 
            return {balance: 0, nonce: 0};
        } else {
            return {balance: wallets[address].amount,
                nonce: wallets[address].nonce}
        }
    }


}
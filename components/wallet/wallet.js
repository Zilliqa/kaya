

/* Wallet Component */
const crypto = require('crypto');
const zilliqa_util = require('../../lib/util')
let colors = require('colors');
var debug_wallet = require('debug')('testrpc:wallet');


//@dev: As this is a testrpc, private keys will be stored

// Wallet will store three things - address, private key and balance
wallets = {};

function printWallet() {
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
}

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

    bootstrap: () => { 
        for(var i=0; i < 10; i++){
            createNewWallet();
        }
        printWallet();
    },

    deductFunds: (address, amount) => {
        debug_wallet(`Deducting ${amount} from ${address}`);
        debug_wallet(wallets);
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
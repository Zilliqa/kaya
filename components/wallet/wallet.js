

/* Wallet Component */
const crypto = require('crypto');
const zilliqa_util = require('../../lib/util')
let colors = require('colors');
var debug_wallet = require('debug')('testrpc:wallet');
const Table = require('cli-table');
const table = new Table({
    head: ['Address', 'Amount', 'PrivateKey']
  , colWidths: [70, 20, 80]
});


//@dev: As this is a testrpc, private keys will be stored

// Wallet will store three things - address, private key and balance
wallets = [];

function printWallet() {
    if(wallets.length == 0) { 
        console.log('No wallets generated.');
    } else {
        console.log(table.toString());
    }
}

function createNewWallet() {
    let pk = zilliqa_util.generatePrivateKey();
    let address = zilliqa_util.getAddressFromPrivateKey(pk);
    let privKey_string = pk.toString('hex');
    let amt = 100000;
    newWallet = {
        address: address,
        privateKey: privKey_string,
        amount: amt
    };
    
    return newWallet;
}



module.exports = {

    bootstrap: () => { 
        for(var i=0; i < 10; i++){
            var newWallet = createNewWallet();
            wallets.push(newWallet);
            table.push([newWallet.address, newWallet.amount, newWallet.privateKey]);
        }
        printWallet();
    }

}
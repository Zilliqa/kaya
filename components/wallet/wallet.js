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

/* Wallet Component */
const assert = require('assert');
const { Zilliqa } = require('zilliqa-js');
const BN = require('bn.js');
const { logVerbose, consolePrint } = require('../../utilities');
const config = require('../../config');
const logLabel = 'Wallet';

// @dev: As this is a kaya, private keys will be stored
// note: Real systems do not store private key

// Wallet will store address, private key and balance
let wallets = {};

/*  Dummy constructor for zilliqajs */
// @dev: Will be replaced once zilliqa-js exposes utils without constructors
const zilliqa = new Zilliqa({
  nodeUrl: 'http://localhost:8888',
});

const createNewWallet = () => {
  const pk = zilliqa.util.generatePrivateKey();
  const address = zilliqa.util.getAddressFromPrivateKey(pk);
  const newWallet = {
    privateKey: pk,
    amount: config.wallet.defaultAmt,
    nonce: config.wallet.defaultNonce,
  };
  wallets[address] = newWallet;
};

// validate an accounts object to check validity
const validateAccounts = (accounts) => {
  Object.keys(accounts).forEach((key) => {
    if (!zilliqa.util.isAddress(key)) {
      throw new Error(`Invalid address ${key}`);
    }
    const account = accounts[key];
    // check if account has the necessary properties
    if (!account.privateKey && !account.nonce && !account.amount) {
      throw new Error('Invalid fields');
    }

    const addressFromPK = zilliqa.util.getAddressFromPrivateKey(
      account.privateKey,
    );
    if (addressFromPK !== key) {
      logVerbose(logLabel, 'Validation failure: Invalid Address and Private key-pair');
      throw new Error(`Invalid address for ${key}`);
    }
    if (Number.isInteger(account.nonce) && Number.isInteger(account.amount)) {
      if (account.nonce < 0 || account.amount < 0) {
        throw new Error('Invalid nonce or amount');
      }
    } else {
      logVerbose(logLabel, 'Amount/nonce is not valid type');
      throw new Error('Invalid nonce or amount');
    }
  });
  logVerbose(logLabel, 'Valid accounts file');
};

module.exports = {
  
  createWallets: (n) => {
    assert(n > 0);
    for (let i = 0; i < n; i += 1) {
      createNewWallet();
    }
  },

  // load accounts object into wallets
  loadAccounts: (accounts) => {
    validateAccounts(accounts);
    logVerbose(logLabel, 
      `${Object.keys(accounts).length} wallets bootstrapped from file`,
    );
    wallets = accounts;
  },

  saveAccounts: (savedDir, timestamp) => {
    const targetFilePath = `${savedDir}${timestamp}_accounts.json`;
    logVerbose(logLabel, `Saving account details to ${targetFilePath}`);

  },

  getAccounts: () => wallets,

  printWallet: () => {
    if (wallets.length === 0) {
      console.log('No wallets generated.');
    } else {
      consolePrint('Available Accounts');
      consolePrint('='.repeat(80));
      const accountAddresses = Object.keys(wallets);
      const keys = [];
      accountAddresses.forEach((addr, index) => {
        consolePrint(
          `(${index+1}) ${addr}\t(Amt: ${wallets[addr].amount})\t(Nonce: ${
            wallets[addr].nonce
          })`);
          keys.push(wallets[addr].privateKey);
      });

      consolePrint('\n Private Keys ');
      consolePrint('='.repeat(80));
      keys.forEach((key, i) => {
        consolePrint(`(${i+1}) ${key}`);
      });
      consolePrint('='.repeat(80));
    }
  },

  sufficientFunds: (address, amount) => {
    // checking if an address has sufficient funds for deduction
    const userBalance = module.exports.getBalance(address);
    logVerbose(logLabel, `Checking if ${address} has ${amount}`);
    if (userBalance.balance < amount) {
      logVerbose(logLabel, 'Insufficient funds.');
      return false;
    }
    logVerbose(logLabel, 'Sufficient Funds.');
    return true;
  },

  /** 
   * Deduct funds from an account
   * @param: {string}: Address of an account
   * @param: {Number} amount: amount to be deducted
   * Does not return any value
   */

  deductFunds: (address, amount) => {

    logVerbose(logLabel, `Deducting ${amount} from ${address}`);
    if (!zilliqa.util.isAddress(address)) {
      throw new Error('Address size not appropriate');
    }
    if (!wallets[address] || !module.exports.sufficientFunds(address, amount)) {
      throw new Error('Insufficient Funds');
    }

    // deduct funds
    let currentBalance = wallets[address].amount;
    logVerbose(logLabel, `Sender's previous Balance: ${currentBalance}`);
    currentBalance -= amount;
    if (currentBalance < 0) {
      throw new Error('Unexpected error, funds went below 0');
    }
    wallets[address].amount = currentBalance;
    logVerbose(logLabel, 
      `Deduct funds complete. Sender's new balance: ${wallets[address].amount}`,
    );
  },

  /** 
   * Add funds to an account address
   * @param: { string } address - Address of recipient
   * @param: { Number } amount - amount of zils to transfer
   * Does not return any value
   */
  addFunds: (address, amount) => {
    logVerbose(logLabel, `Adding ${amount} to ${address}`);
    if (!zilliqa.util.isAddress(address)) {
      throw new Error('Address size not appropriate');
    }
    if (!wallets[address]) {
      // initialize new wallet account
      logVerbose(logLabel, `Creating new wallet account for ${address}`);
      wallets[address] = {};
      wallets[address].amount = 0;
      wallets[address].nonce = 0;
    }
    let currentBalance = wallets[address].amount;
    logVerbose(logLabel, `Recipient's previous Balance: ${currentBalance}`);

    // add amount
    const bnCurrentBalance = new BN(currentBalance);
    const bnAmount = new BN(amount);
    const resultBalance = bnCurrentBalance.add(bnAmount);

    // FIXME: Change wallet address amount to BN objects
    wallets[address].amount = resultBalance.toNumber();
    logVerbose(logLabel, 
      `Adding funds complete. Recipient's new Balance: ${
        wallets[address].amount
      }`,
    );
  },

  increaseNonce: (address) => {
    logVerbose(logLabel, `Increasing nonce for ${address}`);
    if (!zilliqa.util.isAddress(address)) {
      throw new Error('Address size not appropriate');
    }
    if (!wallets[address]) {
      throw new Error('Address not found');
    } else {
      const newNonce = wallets[address].nonce + 1;
      wallets[address].nonce = newNonce;
      logVerbose(logLabel, `New nonce for ${address} : ${newNonce}`);
    }
  },

  getBalance: (value) => {
    if (!zilliqa.util.isAddress(value)) {
      throw new Error('Address size not appropriate');
    }
    logVerbose(logLabel, `Getting balance for ${value}`);
    address = value.toLowerCase();

    if (!wallets[address]) {
      return {
        balance: 0,
        nonce: 0,
      };
    }

    return {
      balance: wallets[address].amount,
      nonce: wallets[address].nonce,
    };
  },
};

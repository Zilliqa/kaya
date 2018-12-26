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
const zCrypto = require('@zilliqa-js/crypto');
const zUtils = require('@zilliqa-js/util')
const BN = require('bn.js');
const { logVerbose, consolePrint } = require('../../utilities');
const config = require('../../config');
const logLabel = 'Wallet';
const zCore = require('@zilliqa-js/core')
const { RPCError } = require('../CustomErrors');

const errorCodes = zCore.RPCErrorCode;

// @dev: As this is a kaya, private keys will be stored
// note: Real systems do not store private key

// Wallet will store address, private key and balance
let wallets = {};

/**
 * Create a new wallet with the settings registered in `config.js` file
 * @returns { Object } - wallet containing private key, amount and nonce
 */

const createNewWallet = () => {
  const pk = zCrypto.schnorr.generatePrivateKey();
  const address = zCrypto.getAddressFromPrivateKey(pk);
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
    if (!zUtils.validation.isAddress(key)) {
      throw new Error(`Invalid address ${key}`);
    }
    const account = accounts[key];
    // check if account has the necessary properties
    if (!account.privateKey && !account.nonce && !account.amount) {
      throw new Error('Invalid fields');
    }

    const addressFromPK = zCrypto.getAddressFromPrivateKey(
      account.privateKey,
    );
    if (addressFromPK !== key) {
      logVerbose(logLabel, 'Validation failure: Invalid Address and Private key-pair');
      throw new Error(`Invalid address for ${key}`);
    }
    if (Number.isInteger(account.nonce)) {
      if (account.nonce < 0) {
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
    Object.keys(accounts).map(addr => {
      accounts[addr].amount = new BN(accounts[addr].amount);
    });
    logVerbose(logLabel,
      `${Object.keys(accounts).length} wallets bootstrapped from file`,
    );
    wallets = accounts;
  },

  saveAccounts: (savedDir, timestamp) => {
    const targetFilePath = `${savedDir}${timestamp}_accounts.json`;
    logVerbose(logLabel, `Saving account details to ${targetFilePath}`);

  },

  // @fixme: Convert wallet object's amount field into string before exporting out
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
        const balanceInZils = zUtils.units.fromQa(wallets[addr].amount, 'zil');
        consolePrint(
          `(${index + 1}) ${addr}\t(${balanceInZils} ZILs)\t(Nonce: ${
          wallets[addr].nonce
          })`);
        keys.push(wallets[addr].privateKey);
      });

      consolePrint('\n Private Keys ');
      consolePrint('='.repeat(80));
      keys.forEach((key, i) => {
        consolePrint(`(${i + 1}) ${key}`);
      });
      consolePrint('='.repeat(80));
    }
  },

  /**
   * sufficientFunds : Checks if a given address has sufficient zils
   * @param { String } : address
   * @param { BN } : amount of zils
   * @returns { Boolean } : True if there is sufficient zils, False if otherwise
   */

  sufficientFunds: (address, amount) => {
    if(!BN.isBN(amount)) {
      throw new Error('Type error');
    };
    // checking if an address has sufficient funds for deduction
    logVerbose(logLabel, `Checking if ${address} has ${amount}`);
    const bnCurrentBalance = wallets[address.toLowerCase()].amount
    const fundsSufficient = amount.lte(bnCurrentBalance) ? true : false;
    logVerbose(logLabel, `Funds sufficient ${fundsSufficient}`);
    return fundsSufficient;
  },

  /** 
   * Deduct funds from an account
   * @param { String }: Address of an account
   * @param { BN }: amount to be deducted
   * Does not return any value
   */

  deductFunds: (address, amount) => {
    if(!BN.isBN(amount)) {
      throw new Error('Type error');
    };

    logVerbose(logLabel, `Deducting ${amount} from ${address}`);
    if (!zUtils.validation.isAddress(address)) {
      throw new Error('Address size not appropriate');
    }
    if (!wallets[address] || !module.exports.sufficientFunds(address, amount)) {
      throw new Error('Insufficient Funds');
    }

    // deduct funds
    let currentBalance = wallets[address].amount;
    logVerbose(logLabel, `Sender's previous Balance: ${currentBalance}`);
    const newBalance = currentBalance.sub(amount);
    wallets[address].amount = newBalance;
    logVerbose(logLabel,
      `Deduct funds complete. Sender's new balance: ${wallets[address].amount}`,
    );
  },

  /** 
   * Add funds to an account address
   * @param { string }: address - Address of recipient
   * @param { Number }: amount - amount of zils to transfer
   * Does not return any value
   */
  addFunds: (address, amount) => {
    logVerbose(logLabel, `Adding ${amount} to ${address}`);
    if(!BN.isBN(amount)) {
      throw new Error('Type error');
    };
    if (!zUtils.validation.isAddress(address)) {
      throw new RPCError('Address size not appropriate', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }
    if (!wallets[address]) {
      // initialize new wallet account
      logVerbose(logLabel, `Creating new wallet account for ${address}`);
      wallets[address] = {};
      wallets[address].amount = new BN(0);
      wallets[address].nonce = 0;
    }
    let currentBalance = wallets[address].amount;
    logVerbose(logLabel, `Recipient's previous Balance: ${currentBalance.toString()}`);

    // add amount
    const resultBalance = currentBalance.add(amount);
    wallets[address].amount = resultBalance;

    logVerbose(logLabel,
      `Adding funds complete. Recipient's new Balance: ${
      wallets[address].amount.toString()
      }`,
    );
  },

  /**
   * Increases nonce for a given address
   * @param { String } address 
   */

  increaseNonce: (address) => {
    logVerbose(logLabel, `Increasing nonce for ${address}`);
    if (!zUtils.validation.isAddress(address)) {
      throw new RPCError('Address size not appropriate', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }
    if (!wallets[address]) {
      throw new RPCError('Account is not created', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    } else {
      const newNonce = wallets[address].nonce + 1;
      wallets[address].nonce = newNonce;
      logVerbose(logLabel, `New nonce for ${address} : ${newNonce}`);
    }
  },

  /**
   * GetBalance: Returns the balance for a given address
   * Throws if the address is not well-formed
   * @param { String } : value - address
   * @returns {Object} { balance: {String}, nonce; Number}
   */

  getBalance: (value) => {
    if (!zUtils.validation.isAddress(value)) {
      throw new RPCError('Address size not appropriate', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }

    const address = value.toLowerCase();
    logVerbose(logLabel, `Getting balance for ${address}`);

    if (!wallets[address]) {
      throw new RPCError('Account is not created', errorCodes.RPC_INVALID_ADDRESS_OR_KEY, null);
    }

    return {
      balance: (wallets[address].amount).toString(),
      nonce: wallets[address].nonce,
    };
  },
};

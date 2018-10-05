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

require("isomorphic-fetch");
const BN = require("bn.js");
const { Zilliqa } = require("zilliqa-js");
const { promisify } = require("util");
const url = "http://localhost:4200";
const { argv } = require("yargs");

const zilliqa = new Zilliqa({
  nodeUrl: url,
});

const makeTxnDetails = (nonceVal) => {
    txnDetails = {
        version: 0,
        nonce: nonceVal,
        to: recipient,
        amount: new BN(0),
        gasPrice: 1,
        gasLimit: 2000,
        data: JSON.stringify(msg).replace(/\\"/g, '"'),
    };
    return txnDetails;
};

const getNonceAsync = addr => {
  return new Promise((resolve, reject) => {
    zilliqa.node.getBalance({ address: addr }, (err, data) => {
      if (err || data.error) {
        reject(err);
      } else {
        resolve(data.result.nonce);
      }
    });
  });
};

let privateKey;
let recipient;

if (argv.test) {
  // test mode uses keys from the account fixtures
  privateKey = "db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3";
  recipient = "cef48d2ec4086bd5799b659261948daab02b760d";
} else {
  // User supplies the private key through `--key`
  if (argv.key) {
    privateKey = argv.key;
    console.log(`Your Private Key: ${privateKey} \n`);
  } else {
    console.log("No private key given! Generating random privatekey.".green);
    privateKey = zilliqa.util.generatePrivateKey();
    console.info(`Your Private Key: ${privateKey.toString("hex")}`);
  }

  if (!argv.to) {
    console.log("To address required");
    process.exit(0);
  }
  recipient = argv.to;
}

const senderAddr = zilliqa.util.getAddressFromPrivateKey(privateKey);
console.log(senderAddr);
const msg = {
  _tag: "setHello",
  _amount: "0",
  _sender: `0x${senderAddr}`,
  params: [
    {
      vname: "msg",
      type: "String",
      value: "Morning",
    },
  ],
};


/*
*   Main Logic
*/

// Get user's nonce and increment it by one before sending transaction
getNonceAsync(senderAddr)
  .then(nonce => {
    console.log(`User's current nonce: ${nonce}`);
    const nonceVal = nonce + 1;
    console.log(`Payload's Nonce is ${nonceVal}`);
    const xnDetails = makeTxnDetails(nonceVal);
    const txn = zilliqa.util.createTransactionJson(privateKey, txnDetails);
    zilliqa.node.createTransaction(txn, (err, data) => {
        if (err || data.error) {
          console.log(err);
        } else {
          console.log(data);
        }
      });
  })
  .catch(err => console.log(err));

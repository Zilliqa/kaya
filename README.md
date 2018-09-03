# Kaya - Zilliqa's RPC client for testing and development
[![Gitter chat](http://img.shields.io/badge/chat-on%20gitter-077a8f.svg)](https://gitter.im/Zilliqa/CommunityDev)
[![Build Status](https://travis-ci.com/Zilliqa/kaya.svg?branch=master)](https://travis-ci.com/Zilliqa/kaya)


Kaya is Zilliqa's RPC server for testing and development. It is personal blockchain which makes developing application easier and faster. Kaya emulates the Zilliqa's blockchain behavior, and follows the expected server behavior as seen in the [`zilliqa-js`](https://github.com/Zilliqa/Zilliqa-JavaScript-Library).

The goal of the project is to support all endpoints in Zilliqa Javascript API, making it easy for app developers to build Dapps on our platform.

Kaya is under development. See [roadmap here](https://github.com/Zilliqa/kaya/blob/master/ROADMAP.md). 

Currently, Kaya supports the following functions:
* `CreateTransaction`
* `GetTransaction`
* `GetRecentTransactions`
* `GetNetworkID`
* `GetSmartContractState`
* `GetSmartContracts`
* `GetBalance`
* `GetSmartContractInit`
* `GetSmartContractCode`

Methods that are NOT supported:
* `GetDsBlock`
* `GetTxBlock`
* `GetLatestDsBlock`
* `GetLatestTxBlock`

In addition, the following features are not supported yet:
* Multi-contract calls
* Events

## Installation
Run `npm install`, then `node server.js`.
Debug mode: `npm run debug`. Debug mode provides greater verbosity about your code that was being sent to the rpc server.

### Compiling Scilla

`Kaya` uses the scilla interpreter (scilla-runner) to interpret `.scilla` files. As such, you will have to compile the binary yourself from the [scilla repository](https://github.com/Zilliqa/scilla).

To compile the interpreter:
1. Ensure that you have installed the related dependencies: [INSTALL.md](https://github.com/Zilliqa/scilla/blob/master/INSTALL.md)
2. Then, run `make clean; make`
3. Copy the `scilla-runner` from `[SCILLA_DIR]/bin` into `[Kaya_DIR]/components/scilla/`

## Server Usage

To run the server, do:
* Normal: `npm start`
* Normal with debug mode: `npm run debug`
*
The server listens on port 4200 by default. You can change the port through the `config.js` file.

### Advanced: Persistent Storage using Kaya RPC
By default, the data states are non-persistent. Once you shut down the node server, everything will be deleted.

To enable persistence data, use:
```
node server.js --save
```
The file containing the state will be stored in the `/data` folder. Blockchain-specific information such as transaction logs are stored in `data/save/YYYYMMDDhhmmss_blockchain_states.json`.

You can load the files using:
```
node server.js --load data/save/YYYYMMDDhhmmss_blockchain_states.json
```

## Testing

Automated tests are a work-in-progress. For now, you have to run tests manually. 

From `test/scripts/`, you can use run `node DeployContract.js` to test contract deployment. 
Then, use `node CreateTransaction --key [private-key] --to [contract_addr]` to make transition calls. 
You can use the `curl` commands stated in the [jsonrpc apidocs](https://apidocs.zilliqa.com/#introduction) to test the rest of the functions.

Use `--key` to specify a private key. Otherwise, a random privatekey will be generated.

Sample Test Procedure: 
1. Start the server using `node server.js`
2. Deploy a contract using `node DeployContract.js --key [private_key]`.
3. Check where the contract is deployed. It should be on the logs if you have enabled `debug` mode, otherwise you can check it through the `GetSmartContracts` method.
4. Send a transaction using `node CreateTransaction.js --key [private_key] --to [Contract_address]`

## License

kaya is released under GPLv3. See [license here](https://github.com/Zilliqa/kaya/blob/master/LICENSE)

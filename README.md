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
* `GetContractAddressFromTransactionID`
* `GetMinimumGasPrice`

Methods that are NOT supported:
* `GetShardingStructure`
* `GetNumDSBlocks`
* `GetDSBlockRate`
* `GetNumTxBlocks`
* `GetTxBlockRate`
* `GetNumTransactions`
* `GetTransactionRate`
* `GetCurrentMiniEpoch`
* `GetCurrentDSEpoch`
* `GetNumTxnsTxEpoch`
* `GetNumTxnsDSEpoch`


In addition, the following features are not supported yet:
* Multi-contract calls
* Events

## Getting Started
### Installation

Kaya RPC server is distributed as a Node package via `npm`. Ensure that you have [Node.js](https://nodejs.org/en/) (>= 10.13.0).

```
npm install -g kaya-cli
```

Scilla files must be processed using the `scilla-interpreter`. The [Scilla interpreter](https://scilla.readthedocs.io/en/latest/interface.html) executable provides a calling interface that enables users to invoke transitions with specified inputs and obtain outputs. 

#### Using Remote Scilla Interpreter (Default)

By default, Kaya RPC uses the remote scilla interpreter to process `.scilla` files. You do not have to change any configurations.

#### Using Local Scilla Interpreter
You can choose to use your own scilla interpreter locally. To do it, you will have to compile the binaries yourself from the [scilla repository](https://github.com/Zilliqa/scilla) and transfer it to the correct directory within Kaya RPC. 

Instructions: 
1. Ensure that you have installed the related dependencies: [INSTALL.md](https://github.com/Zilliqa/scilla/blob/master/INSTALL.md)
2. Then, run `make clean; make`
3. Copy the `scilla-runner` from `[SCILLA_DIR]/bin` into `[Kaya_DIR]/components/scilla/`
4. Open `config.js` file and set the `config.scilla.remote` to `false`. Alternative, use `-r false` at startup.

### Usage

#### Command Line
```
$ kaya-cli <options>
```
Options:
* `-d` or `--data`: Relative path where state data will be stored. Creates directory if path does not exists
* `-f` or `--fixtures`: Load fixed account addresses and keys (fixtures) from a JSON-file
* `-l` or `--load`: Load data files from a JSON file
* `-n` or `--numAccounts`: Number of accounts to load at start up. Only used if fixtures file is not defined.
* `-p` or `--port`: Port number to listen to (Default: `4200`)
* `-r` or `--remote`: Option to use remote interpreter or local interpreter. Remote if True
* `-s` or `--save`: Saves data files to `saved/` directory by the end of the session
* `-v` or `--verbose`: Log all requests and responses to stdout

#### Example Usage
* Starts server based on predefined wallet files with verbose mode.
```
node server.js -v -f test/account-fixtures.json  
```
* Load data files from a previous session and save the data at the end of the session
```
node server.js -v -s --load test/sample-export.json
```

#### Presents

KayaRPC comes with a few preset configurations for lazy programmers:

* `npm run debug`: Use server with random account keypairs
* `npm run debug:fixtures`: Use server with fixed account keypairs loaded from `test/account-fixtures.json`
* `npm start`: The same as `node server.js` - random account keypair generations with no verbosity

## Testing

Some of the functions in Kaya RPC are covered under automated testing using `jest`. However, scilla related transactions are not covered through automated testing. To test the `CreateTransaction` functionalities, you will have to test it manually.

From `test/scripts/`, you can use run `node TestBlockchain.js` to test the Kaya RPC. The script will make a payment transaction, deployment transaction and transition invocation. 

## License

kaya is released under GPLv3. See [license here](https://github.com/Zilliqa/kaya/blob/master/LICENSE)

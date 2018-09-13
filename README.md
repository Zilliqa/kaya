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

## Getting Started
### Installation
Install the node packages and dependencies: `npm install`

Scilla files must be processed using the `scilla-interpreter`. The [Scilla interpreter](https://scilla.readthedocs.io/en/latest/interface.html) executable provides a calling interface that enables users to invoke transitions with specified inputs and obtain outputs. 

#### Using Remote Scilla Interpreter (Default)

By default, Kaya RPC uses the remote scilla interpreter to process `.scilla` files. You do not have to change any configurations.

#### Using Local Scilla Interpreter
You can choose to use your own scilla interpreter locally. To do it, you will have to compile the binary yourself from the [scilla repository](https://github.com/Zilliqa/scilla) and transfer it to the correct directory within Kaya RPC. 

Instructions: 
1. Ensure that you have installed the related dependencies: [INSTALL.md](https://github.com/Zilliqa/scilla/blob/master/INSTALL.md)
2. Then, run `make clean; make`
3. Copy the `scilla-runner` from `[SCILLA_DIR]/bin` into `[Kaya_DIR]/components/scilla/`
4. Open `config.js` file and set the `config.scilla.remote` to `false`

### Usage
Kaya RPC two modes: normal and debug. The server listens on port `4200` by default. You can change the port through the `config.js` file.
- `npm start` : Normal mode
- `npm run debug`: Enables verbosity mode. Display logs about activities. Useful for debugging

Developers can also start Kaya RPC with accounts from a `fixtures` file. The fixture file is configurable through `config.js`. If you wish to change this file, you will have to follow the format just like `account-fixtures.json`.

To start Kaya RPC with accounts from a file, run one of the following commands:
- `npm run start:fixtures`: Normal mode
- `npm run debug:fixtures`: Greater verbosity. Shows log trail about server activities.

__Recommendation__: We recommend running `npm run debug:fixtures`. Without account fixtures, accounts will be randomly generated at every run. It can be time consuming to change the private keys and addresses each time.

### Advanced: Persistent Storage using Kaya RPC
By default, the data states are non-persistent. Once you shut down the node server, state files and transactions will be deleted.

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

Some of the functions in Kaya RPC are covered under automated testing using `jest`. However, scilla related transactions are not covered through automated testing. To test the `CreateTransaction` functionalities, you will have to test it manually.

From `test/scripts/`, you can use run `node DeployContract.js` to test contract deployment. 
Then, use `node CreateTransaction --key [private-key] --to [contract_addr]` to make transition calls. 
You can use the `curl` commands stated in the [jsonrpc apidocs](https://apidocs.zilliqa.com/#introduction) to test the rest of the functions.

Use `--key` to specify a private key. Otherwise, a random privatekey will be generated.

### Testing with Fixture Files

You can also use the `--test` flag, which uses default test configurations: 
1. Start the server using `npm run debug:fixtures`
2. Deploy a contract using `node DeployContract.js --test`.
3. Check where the contract is deployed. It should be on the logs if you have enabled `debug` mode, otherwise you can check it through the `GetSmartContracts` method.
4. Send a transaction using `node CreateTransaction.js --test`

## License

kaya is released under GPLv3. See [license here](https://github.com/Zilliqa/kaya/blob/master/LICENSE)

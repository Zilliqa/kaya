# ZilTestRPC

zil-testrpc is a personal blockchain which makes developing application easier, faster and safer.
It simulates the Zilliqa's blockchain behavior, and follows the expected server behavior as seen in the [Zil-JSAPI](https://github.com/Zilliqa/Zilliqa-JavaScript-Library)

The goal of the project is to support all endpoints in Zilliqa Javascript API. Currently, TestRPC supports the following functions:
* `CreateTransaction`
* `GetTransaction`
* `GetRecentTransactions`
* `GetNetworkID`
* `GetSmartContractState`
* `GetSmartContracts`


## Installation
Run `npm install`, then `npm start`.

## Server Usage

To run the server, type `npm start`.

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


For now, run the `DeployContract.js` and `CreateTransaction.js` from the `test/scripts`. Use `--key` to specify a private key. Otherwise, a random privatekey will be generated.

Mocha tests to be added soon (help appreciated)
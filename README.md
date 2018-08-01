# ZilTestRPC

zil-testrpc is a personal blockchain which makes developing application easier, faster and safer.
It simulates the Zilliqa's blockchain behavior, and follows the expected server behavior as seen in the [`zilliqa-js`](https://github.com/Zilliqa/Zilliqa-JavaScript-Library).

The goal of the project is to support all endpoints in Zilliqa Javascript API. 

Currently, TestRPC supports the following functions:
* `CreateTransaction`
* `GetTransaction`
* `GetRecentTransactions`
* `GetNetworkID`
* `GetSmartContractState`
* `GetSmartContracts`
* `GetBalance`
* `getSmartContractInit`
* `getSmartContractCode`

Functions that are NOT supported:
* `getDsBlock`
* `getTxBlock`
* `getLatestDsBlock`
* `getLatestTxBlock`

In addition, multi-contract calls are not supported yet.

## Installation
Run `npm install`, then `node server.js`.
Debug mode: `DEBUG=testrpc* node server.js`.

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

Testing coverage is primitive;

From `test/scripts/`, you can use run `node DeployContract.js` to test contract deployment. 
Then, use `node CreateTransaction --key [private-key] --to [contract_addr]` to make transition calls. 

You can use the `curl` commands stated in the [jsonrpc apidocs](https://apidocs.zilliqa.com/#introduction) to test the rest of the functions.

Use `--key` to specify a private key. Otherwise, a random privatekey will be generated.

Sample Test Procedure: 
1. Start the server using `node server.js`
2. Deploy a contract using `node DeployContract.js --key [private_key].
3. Check where the contract is deployed. It should be on the logs if you have enabled `debug` mode, otherwise you can check it through the `GetSmartContracts` method.
4. Send a transaction using `node CreateTransaction.js --key [priate_key] --to [Contract_address]`

Mocha tests to be added soon (help appreciated)

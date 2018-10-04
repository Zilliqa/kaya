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
You can choose to use your own scilla interpreter locally. To do it, you will have to compile the binaries yourself from the [scilla repository](https://github.com/Zilliqa/scilla) and transfer it to the correct directory within Kaya RPC.

Instructions:
1. Ensure that you have installed the related dependencies: [INSTALL.md](https://github.com/Zilliqa/scilla/blob/master/INSTALL.md)
2. Then, run `make clean; make`
3. Copy the `scilla-runner` from `[SCILLA_DIR]/bin` into `[Kaya_DIR]/components/scilla/`
4. Open `config.js` file and set the `config.scilla.remote` to `false`. Alternative, use `-r false` at startup.

### Usage

#### Command Line
```
$ node server.js
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

## Docker

a Dockerfile has been created to build a docker image which can be used to start Kaya RPC within a docker container. You can build the docker image on your local machine:

`$ docker build -t kaya .`

and run it afterwards with the defaults on port 4200, debugging false and against a remote scilla interperter:

`
$ docker run --rm -d -p 4200:4200 kaya

$ docker logs -f kaya-local
docker run --rm -p 4200:4200 kaya
ZILLIQA KAYA RPC SERVER (ver: 0.2.0)
Server listening on 127.0.0.1:4200
Scilla interperter running remotely from: https://scilla-runner.zilliqa.com/contract/call
================================================================================
Available Accounts
=============================
(0) 16cc5cfaeff4945fc2edc1f9a73c1ba38f3a169c (Amt: 100000) (Nonce: 0)
(1) 9ba385bfdfa5aaa15f638702c99c917961b7fa99 (Amt: 100000) (Nonce: 0)
(2) 394b0e1863315841d4c3acf40a8dc6d9537e558e (Amt: 100000) (Nonce: 0)
(3) f593719f912cf12ce438608f9131b5126ab25873 (Amt: 100000) (Nonce: 0)
(4) 25b2d997b8b1a20302a8a749c35a14e36495856d (Amt: 100000) (Nonce: 0)
(5) f4cd38f387465505a316be8f552f61f3140970d7 (Amt: 100000) (Nonce: 0)
(6) 844f41fafd3181f821d7ec8d70073fca862762f5 (Amt: 100000) (Nonce: 0)
(7) 1e15ea5841c856318455a682db0d5587ea18cfd2 (Amt: 100000) (Nonce: 0)
(8) e7d8fd2d2706f1f5ea55181a90757285b317596d (Amt: 100000) (Nonce: 0)
(9) 4679743b469257d1fcf3c3ed1fa436d039bab446 (Amt: 100000) (Nonce: 0)

 Private Keys
 =============================
 (0) da6e6d128720a4d2c97677718b2cb2749e5b6ad89ef5c0bf91084658b55e84a5
 (1) 22f92cf224b77b8cb4b8a524ed78a378ddb278abf8f3415e600116df94dac26a
 (2) c3c14bcb74d4146f1dd8d1e17ccd4266641634b22971edbcdddb495c1c837e9a
 (3) 67846d97dd865fe681a79a1ce1f2687d054d521457d03bd5e4466b1147a2c108
 (4) 3b3627cb909de680eebf34131ab703fb6fc5e5295475579212c2c727cccbeecc
 (5) 59e1579f2e41a80e2b31e9e0ab59419eb733be8d8b2aaebcbb7f917d3b305ac9
 (6) d811444994f8337d4229ea9acda1ee2af9fe43155d91e1dd8d34b1968ab53a9e
 (7) c3bbddbdc662769760f7220fec925dc407afdd2dd1a166370402d09057418bb7
 (8) 4429129188cccaf9152e52371ee09cdd7a13fb0bea9048cf6f58f89886572dd1
 (9) 78043ccc1ae0fd67de67e48b43f1cec7260294d35ab9ce844ca05a50bb9bb45c

$ curl http://localhost:4200
Kaya RPC Server%
`

or run it with some custom parameters to enable debugging, a custom port and against a local scilla interpereter.

`
$ docker run --rm -p 5000:5000 -e PORT="5000" -e REMOTE="false" kaya:latest --debug

ZILLIQA KAYA RPC SERVER (ver: 0.2.0)
Server listening on 127.0.0.1:5000
Scilla interpreter running locally
================================================================================
Available Accounts
=============================
(0) 6b20c0cb05228d6461eda3290e0dcffac224557f (Amt: 100000) (Nonce: 0)
(1) 4c6835acab74b6fe79642f7cd77135c957581413 (Amt: 100000) (Nonce: 0)
(2) a37243176688a70f9942cdd09152accdbd95bf8a (Amt: 100000) (Nonce: 0)
(3) fc1f02454bb972d9ce28a787a47afb81280fe586 (Amt: 100000) (Nonce: 0)
(4) ce6d38378c41a086dd0181c22819d8948961e426 (Amt: 100000) (Nonce: 0)
(5) 82746cba7b213851e89a6edb1b2617b19c509ed7 (Amt: 100000) (Nonce: 0)
(6) 2535fccbddaad3234c719080fbeedfe6acd0855e (Amt: 100000) (Nonce: 0)
(7) 9a769c1aa062ffa0074cda3c751df1e9073da103 (Amt: 100000) (Nonce: 0)
(8) afb3a62f3f166a9107b7d59a9bc60a4a092fdf0f (Amt: 100000) (Nonce: 0)
(9) bf6a645e533696ad6184c6890dd2e03f703b8979 (Amt: 100000) (Nonce: 0)

 Private Keys
 =============================
 (0) 5dca73222536b068c4de37ebce3f309218d254b39afde984f28d0fe133d8edfd
 (1) 64540242416897b42e024ee7c92cc54bc1222437aae37043eb94eb9f50b1a670
 (2) f1d3607480889a40ebe6d7b5a7e2f35b887eedd5c14a58440cc13e1d3273505c
 (3) 3e9b86c0999c3e8e9c86b88d500218f7c2899101bd395fe6cef777c2ec975e78
 (4) 6fc03a088b6f5ad0fd6cdd98bfa48535102b3be2fdffe8a2c3f4a11dd2fec3fb
 (5) 78e57fb6be4b039b3d767eb9f4c94c9c94c2458af4c2058500b28953d399f05c
 (6) 5fffdebf924952416efa4992699bcc144abb788d4a2164e124df9acae7048732
 (7) 07eb4be6ad36ac255f6401580dd4ac6ef81e429b06c8ae2aabf87201b6a8be39
 (8) 6670b623d93d52cb8d610d0fc68f4862b48cb90426a4cd4b837374e424d8349e
 (9) eb5f1e20dfbe52982e22443c5e1360338aec0f6d99a101c475f3a4139cb615d5


$ curl http://localhost:5000
Kaya RPC Server%
`

## License

kaya is released under GPLv3. See [license here](https://github.com/Zilliqa/kaya/blob/master/LICENSE)

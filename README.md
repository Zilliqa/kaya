# ZilTestRPC

zil-testrpc is a personal blockchain which makes developing application easier, faster and safer.
It simulates the Zilliqa's blockchain behavior, and follows the expected server behavior as seen in the [Zil-JSAPI](https://github.com/Zilliqa/Zilliqa-JavaScript-Library)

The goal of the project is to support all endpoints in Zilliqa Javascript API. Currently, TestRPC supports the following functions:
* `createTransaction`
* `getTransaction`
* `getNetworkID`


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

Mocha tests to be added soon.

For now, testing is done with the testapp found in `test/testapp/`. 

You can choose to either use the config files, or supply the parameters manually. 

Sample usage:
Deploy Contract
```
node index.js --method deploy
```

Set Transaction:
```
node index.js --method createtxn --c_method setHello --c_val 6665 --c_addr 4e31a341fd2387940991c2f9fc3a2acf043a4424 --key 3687e2a2d0c8f3bfc188ec5c705667c5dee0b4f5399dfc71e513d1969ef2abd9 
```

To get started, go to `test/testapp/`:
1. Clone the config file `cp config-template.js config.js`. 




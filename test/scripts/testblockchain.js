const fs = require('fs');
const { BN, Long } = require('@zilliqa-js/util');
const { Zilliqa } = require('@zilliqa-js/zilliqa');
const zilliqa = new Zilliqa('http://localhost:4200');

// Populate the wallet with an account
zilliqa.wallet.addByPrivateKey(
  'db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3',
);

async function testBlockchain() {
  try {
    // Send a transaction to the network
    const tx = await zilliqa.blockchain.createTransaction(
      zilliqa.transactions.new({
        version: 1,
        toAddr: 'd90f2e538ce0df89c8273cad3b63ec44a3c4ed82',
        amount: new BN(888),
        // gasPrice must be >= minGasPrice
        gasPrice: new BN(101),
        // can be `number` if size is <= 2^53 (i.e., window.MAX_SAFE_INTEGER)
        gasLimit: Long.fromNumber(10),
      }),
    );
    console.log(tx);

    console.log('Deploying a contract now');
    // Deploy a contract
    const code = fs.readFileSync('HelloWorld.scilla', 'utf-8');
    const init = [
      {
        vname: 'owner',
        type: 'ByStr20',
        // NOTE: all byte strings passed to Scilla contracts _must_ be
        // prefixed with 0x. Failure to do so will result in the network
        // rejecting the transaction while consuming gas!
        value: '0x7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8',
      },
      // Necessary for local Kaya testing
      {
        vname: '_creation_block',
        type: 'BNum',
        value: '100'
      }
    ];

    // instance of class Contract
    const contract = zilliqa.contracts.new(code, init);

    const hello = await contract.deploy(new BN(100), Long.fromNumber(5000));
    console.log(hello);

    const callTx = await hello.call('setHello', [
      {
        vname: 'msg',
        type: 'String',
        value: 'Hello World',
      },
    ], new BN(0), Long.fromNumber(5000), new BN(101));
    console.log(callTx);
    const state = await hello.getState();
    console.log(state);
  } catch (err) {
    console.log('Blockchain Error');
    console.log(err);
  }
}

testBlockchain();

const { Transaction } = require('@zilliqa-js/account');
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
        gasPrice: new BN(1),
        // can be `number` if size is <= 2^53 (i.e., window.MAX_SAFE_INTEGER)
        gasLimit: Long.fromNumber(10),
      }),
    );
    console.log(tx);
    
    console.log('Deploying a contract now');
    // Deploy a contract
    const code = `(* HelloWorld contract *)

import ListUtils

(***************************************************)
(*               Associated library                *)
(***************************************************)
library HelloWorld

let one_msg =
  fun (msg : Message) =>
  let nil_msg = Nil {Message} in
  Cons {Message} msg nil_msg

let not_owner_code = Int32 1
let set_hello_code = Int32 2

(***************************************************)
(*             The contract definition             *)
(***************************************************)

contract HelloWorld
(owner: ByStr20)

field welcome_msg : String = ""

transition setHello (msg : String)
  is_owner = builtin eq owner _sender;
  match is_owner with
  | False =>
    msg = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : not_owner_code};
    msgs = one_msg msg;
    send msgs
  | True =>
    welcome_msg := msg;
    msg = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; code : set_hello_code};
    msgs = one_msg msg;
    send msgs
  end
end

transition getHello ()
    r <- welcome_msg;
    msg = {_tag : "Main"; _recipient : _sender; _amount : Uint128 0; msg : r};
    msgs = one_msg msg;
    send msgs
end`;

    const init = [
      {
        vname: 'owner',
        type: 'ByStr20',
        // NOTE: all byte strings passed to Scilla contracts _must_ be
        // prefixed with 0x. Failure to do so will result in the network
        // rejecting the transaction while consuming gas!
        value: '0x8254b2c9acdf181d5d6796d63320fbb20d4edd12',
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

    const hello = await contract.deploy(new BN(1), Long.fromNumber(5000));
    console.log(hello);


    const callTx = await hello.call('setHello', [
      {
        vname: 'msg',
        type: 'String',
        value: 'Hello World',
      },
    ]);
    const state = await hello.getState();
    console.log(state);
  } catch (err) {
    console.log('Blockchain Error');
    console.log(err);
  }
}

testBlockchain();

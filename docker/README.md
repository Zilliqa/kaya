# Running kaya RPC server in a docker container

This document explains how to build the docker image and run it.
You should have a working docker installation on your workstation.
 
Go to the root of your local git repository

From there, build the docker image:

```bash
$ docker build -f docker/Dockerfile -t zilliqa/kaya:latest .
Sending build context to Docker daemon  98.01MB
Step 1/9 : FROM ubuntu:bionic
...
Successfully built 1547d59aa56d
Successfully tagged zilliqa/kaya:latest
```
Start the container:
```
$ docker run -it -p 4200:4200 zilliqa/kaya

> kaya@0.0.1 debug:fixtures /home/kaya/kaya
> DEBUG=kaya* node server.js --accounts test/account-fixtures.json

ZILLIQA KAYA RPC SERVER (ver: 0.2.0)
Server listening on 127.0.0.1:4200
Scilla interperter running remotely from: https://scilla-runner.zilliqa.com/contract/call
================================================================================
  kaya:app.js Bootstrapping from account fixture files: test/account-fixtures.json +0ms
  kaya:wallet Valid accounts file +0ms
  kaya:wallet 10 wallets bootstrapped from file +0ms
Available Accounts
=============================
(0) 7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8 (Amt: 100000) (Nonce: 0)
(1) d90f2e538ce0df89c8273cad3b63ec44a3c4ed82 (Amt: 100000) (Nonce: 0)
(2) 381f4008505e940ad7681ec3468a719060caf796 (Amt: 100000) (Nonce: 0)
(3) b028055ea3bc78d759d10663da40d171dec992aa (Amt: 100000) (Nonce: 0)
(4) f6dad9e193fa2959a849b81caf9cb6ecde466771 (Amt: 100000) (Nonce: 0)
(5) 10200e3da08ee88729469d6eabc055cb225821e7 (Amt: 100000) (Nonce: 0)
(6) ac941274c3b6a50203cc5e7939b7dad9f32a0c12 (Amt: 100000) (Nonce: 0)
(7) ec902fe17d90203d0bddd943d97b29576ece3177 (Amt: 100000) (Nonce: 0)
(8) c2035715831ab100ec42e562ce341b834bed1f4c (Amt: 100000) (Nonce: 0)
(9) 6cd3667ba79310837e33f0aecbe13688a6cbca32 (Amt: 100000) (Nonce: 0)

 Private Keys 
=============================
(0) db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3
(1) e53d1c3edaffc7a7bab5418eb836cf75819a82872b4a1a0f1c7fcf5c3e020b89
(2) d96e9eb5b782a80ea153c937fa83e5948485fbfc8b7e7c069d7b914dbc350aba
(3) e7f59a4beb997a02a13e0d5e025b39a6f0adc64d37bb1e6a849a4863b4680411
(4) 589417286a3213dceb37f8f89bd164c3505a4cec9200c61f7c6db13a30a71b45
(5) 5430365143ce0154b682301d0ab731897221906a7054bbf5bd83c7663a6cbc40
(6) 1080d2cca18ace8225354ac021f9977404cee46f1d12e9981af8c36322eac1a4
(7) 254d9924fc1dcdca44ce92d80255c6a0bb690f867abde80e626fbfef4d357004
(8) b8fc4e270594d87d3f728d0873a38fb0896ea83bd6f96b4f3c9ff0a29122efe4
(9) b87f4ba7dcd6e60f2cca8352c89904e3993c5b2b0b608d255002edcda6374de4
  kaya:app.js tmp folder created in /home/kaya/kaya/tmp +54ms
  kaya:app.js Directory created +23ms
```
Keep this terminal open!

Start a new terminal to interact with the container running the KAYA RPC Server.

Try to get 'first contact' to see if the server responds:

```bash
$ curl http://localhost:4200
Kaya RPC Server
```
Now, try the basic tests from the test/scripts directory:
```bash
$ cd test/scripts
$ node DeployContract.js --key db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3
Your Private Key: db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3 

Address: 7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8
Pubkey:  03d8e6450e260f80983bcd4fadb6cbc132ae7feb552dda45f94b48c80b86c6c3be
Zilliqa Testing Script
Connected to http://localhost:4200
[ { vname: 'owner',
    type: 'ByStr20',
    value: '0x7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8' },
  { vname: '_creation_block', type: 'BNum', value: '100' } ]
{ id: 1,
  jsonrpc: '2.0',
  result: 'aae3c5d409b176737bb2a29bb709fd59280cdc4f8a6e8ce7981ce0aabca9baa3' }
```
Note that the private key from Account 0 was used.

From the KAYA log in the 1st terminal, you can see the contract address:
```
...
kaya:logic Contract will be deployed at: cef48d2ec4086bd5799b659261948daab02b760d +3ms
...

```
Then create a transaction using this contract:

```bash
$ node CreateTransaction --key db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3 --to cef48d2ec4086bd5799b659261948daab02b760d
Your Private Key: db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3 

Address: 7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8
Zilliqa Testing Script
Connected to http://localhost:4200
{ version: 0,
  nonce: 2,
  to: 'cef48d2ec4086bd5799b659261948daab02b760d',
  amount: <BN: 0>,
  pubKey: '03d8e6450e260f80983bcd4fadb6cbc132ae7feb552dda45f94b48c80b86c6c3be',
  gasPrice: 1,
  gasLimit: 2000,
  code: '',
  data: '{"_tag":"setHello","_amount":"0","_sender":"0x7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8","params":[{"vname":"msg","type":"String","value":"Morning"}]}',
  signature: '2c58cb62273a4cdf441c1cc2721afa7dacd2302ea3f84a126418dc180b3ad71c8a7c5a655eb35c2f65e100a336a3716119c7f304b26d18dafce1c0557328a174' }
{ id: 1,
  jsonrpc: '2.0',
  result: '599c17e9f5bbda32bda03a85f45717b5b01505278fdd38ddcf7b7ab69206fdf9' }
```
Voila!

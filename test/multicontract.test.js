const { readFileSync } = require('fs');
const { BN, bytes, Long } = require('@zilliqa-js/util');
const { Zilliqa } = require('@zilliqa-js/zilliqa');
const KayaProvider = require('../src/provider');
const { loadAccounts } = require('../src/components/wallet/wallet');

const testWallet = {
  address: '7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8',
  privateKey: 'db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3',
  publicKey: '03d8e6450e260f80983bcd4fadb6cbc132ae7feb552dda45f94b48c80b86c6c3be',
  amount: '1000000000000000',
  nonce: 0,
};

const getProvider = () => {
  // sets up transaction history for accounts
  loadAccounts({
    [testWallet.address]: {
      privateKey: testWallet.privateKey,
      amount: testWallet.amount,
      nonce: testWallet.nonce,
    },
  });
  return new KayaProvider({ dataPath: 'data/' });
};

const CHAIN_ID = 111;
const MSG_VERSION = 1;
const version = bytes.pack(CHAIN_ID, MSG_VERSION);

const getZilliqa = () => {
  const zilliqa = new Zilliqa(null, getProvider());
  zilliqa.wallet.addByPrivateKey(testWallet.privateKey);
  zilliqa.wallet.setDefault(testWallet.address);
  return zilliqa;
};

const defaultParams = {
  version,
  toAddr: `0x${'0'.repeat(40)}`,
  amount: new BN(0),
  gasPrice: new BN(1000000000),
  gasLimit: Long.fromNumber(25000),
};

const deploymentParams = {
  ...defaultParams,
  gasLimit: Long.fromNumber(100000),
};

const transactionEventNames = tx => (
  (tx.txParams.receipt.event_logs || []).map(l => l._eventname)
);

describe('Test Multicontract support', () => {
  beforeAll(() => {
    jest.setTimeout(55000);
  });

  test('Contract call chain should work', async () => {
    const zilliqa = getZilliqa();
    const [deployCTx, contractC] = await zilliqa.contracts
      .new(
        readFileSync(`${__dirname}/scilla/chain-call-balance-c.scilla`, 'utf8'),
        [
          { vname: '_scilla_version', type: 'Uint32', value: '0' },
          { vname: '_creation_block', type: 'BNum', value: '0' },
        ],
      )
      .deploy(deploymentParams);
    expect(deployCTx.isConfirmed()).toBe(true);

    const [deployBTx, contractB] = await zilliqa.contracts
      .new(
        readFileSync(`${__dirname}/scilla/chain-call-balance-b.scilla`, 'utf8'),
        [
          { vname: '_scilla_version', type: 'Uint32', value: '0' },
          { vname: '_creation_block', type: 'BNum', value: '0' },
        ],
      )
      .deploy(deploymentParams);
    expect(deployBTx.isConfirmed()).toBe(true);

    const [deployATx, contractA] = await zilliqa.contracts
      .new(
        readFileSync(`${__dirname}/scilla/chain-call-balance-a.scilla`, 'utf8'),
        [
          { vname: '_scilla_version', type: 'Uint32', value: '0' },
          { vname: '_creation_block', type: 'BNum', value: '0' },
        ],
      )
      .deploy(deploymentParams);
    expect(deployATx.isConfirmed()).toBe(true);

    const transitionCall = await contractA.call(
      'acceptAAndTransferToBAndCallC',
      [
        { vname: 'addrB', type: 'ByStr20', value: `0x${contractB.address}` },
        { vname: 'addrC', type: 'ByStr20', value: `0x${contractC.address}` },
      ],
      {
        ...defaultParams,
        amount: new BN(5),
      },
    );
    expect(transitionCall.isConfirmed()).toBe(true);
    expect(transactionEventNames(transitionCall))
      .toEqual(['A', 'B', 'C']);
    const [walletBalance, contractAState, contractBState, contractCState] = await (
      Promise.all([
        zilliqa.blockchain.getBalance(testWallet.address),
        contractA.getState(),
        contractB.getState(),
        contractC.getState(),
      ])
    );
    expect(walletBalance.result.nonce).toBe(4);
    expect(contractAState).toEqual([
      { vname: '_balance', type: 'Uint128', value: '0' },
      { vname: 'last_amount', type: 'Uint128', value: '5' },
    ]);
    expect(contractBState).toEqual([
      { vname: '_balance', type: 'Uint128', value: '0' },
      { vname: 'last_amount', type: 'Uint128', value: '5' },
    ]);
    expect(contractCState).toEqual([
      { vname: '_balance', type: 'Uint128', value: '5' },
      { vname: 'last_amount', type: 'Uint128', value: '5' },
    ]);
  });
});

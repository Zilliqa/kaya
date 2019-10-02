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

describe('Test Mining support', () => {
  beforeAll(() => {
    jest.setTimeout(20000);
  });

  test('Block number should increase', async () => {
    const zilliqa = getZilliqa();
    const blockNumber0 = await zilliqa.blockchain.getNumTxBlocks();
    expect(blockNumber0.result).toBe(0);
    await zilliqa.provider.send('KayaMine');
    const blockNumber1 = await zilliqa.blockchain.getNumTxBlocks();
    expect(blockNumber1.result).toBe(1);
    await zilliqa.provider.send('KayaMine');
    const blockNumber2 = await zilliqa.blockchain.getNumTxBlocks();
    expect(blockNumber2.result).toBe(2);
  });

  test('Scilla interpreter should get different block numbers', async () => {
    const zilliqa = getZilliqa();
    const [deployContract, contract] = await zilliqa.contracts
      .new(
        readFileSync(`${__dirname}/scilla/mining.scilla`, 'utf8'),
        [
          { vname: '_scilla_version', type: 'Uint32', value: '0' },
          { vname: '_creation_block', type: 'BNum', value: '0' },
        ],
      )
      .deploy(deploymentParams);
    expect(deployContract.isConfirmed()).toBe(true);

    const startTimerCall = await contract.call('startTimer', [], defaultParams);
    expect(startTimerCall.isConfirmed()).toBe(true);

    const checkCallBefore = await contract.call('checkTimer', [], defaultParams);
    expect(transactionEventNames(checkCallBefore)).toEqual(['pending']);

    // mine 3 blocks
    await zilliqa.provider.send('KayaMine');
    await zilliqa.provider.send('KayaMine');
    await zilliqa.provider.send('KayaMine');

    const checkCallAfter = await contract.call('checkTimer', [], defaultParams);
    expect(transactionEventNames(checkCallAfter)).toEqual(['success']);
  });
});

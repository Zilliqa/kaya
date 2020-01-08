const { readFileSync } = require('fs');
const { BN, bytes, Long } = require('@zilliqa-js/util');
const { Zilliqa } = require('@zilliqa-js/zilliqa');
const { toChecksumAddress, getAddressFromPrivateKey, getPubKeyFromPrivateKey } = require('@zilliqa-js/crypto');
const KayaProvider = require('../src/provider');
const { loadAccounts } = require('../src/components/wallet/wallet');

const privateKey =  'ebe9139f853d3ba3f509741d3068ccae5215793ed82b0dcf982dd38462a7ab7e'

const testWallet = {
  address: getAddressFromPrivateKey(privateKey),
  privateKey,
  publicKey: getPubKeyFromPrivateKey(privateKey),
  amount: '1000000000000000',
  nonce: 0,
};

const getProvider = () => {
  // sets up transaction history for accounts
  loadAccounts({
    [testWallet.address.toLowerCase().replace('0x', '')]: {
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
        ],
      )
      .deploy(deploymentParams);
    expect(deployCTx.isConfirmed()).toBe(true);

    const [deployBTx, contractB] = await zilliqa.contracts
      .new(
        readFileSync(`${__dirname}/scilla/chain-call-balance-b.scilla`, 'utf8'),
        [
          { vname: '_scilla_version', type: 'Uint32', value: '0' },
        ],
      )
      .deploy(deploymentParams);
    expect(deployBTx.isConfirmed()).toBe(true);

    const [deployATx, contractA] = await zilliqa.contracts
      .new(
        readFileSync(`${__dirname}/scilla/chain-call-balance-a-multiple.scilla`, 'utf8'),
        [
          { vname: '_scilla_version', type: 'Uint32', value: '0' },
        ],
      )
      .deploy(deploymentParams);
    expect(deployATx.isConfirmed()).toBe(true);

    const transitionCall = await contractA.call(
      'acceptAAndTransferToBAndCallC',
      [
        { vname: 'addrB', type: 'ByStr20', value: contractB.address },
        { vname: 'addrC', type: 'ByStr20', value: contractC.address },
      ],
      {
        ...defaultParams,
        amount: new BN(8),
      },
    );
    expect(transitionCall.isConfirmed()).toBe(true);
    expect(transactionEventNames(transitionCall))
      .toEqual(['A', 'B', 'C', 'C']);
    const [walletBalance, contractAState, contractBState, contractCState] = await (
      Promise.all([
        zilliqa.blockchain.getBalance(testWallet.address),
        contractA.getState(),
        contractB.getState(),
        contractC.getState(),
      ])
    );
    expect(walletBalance.result.nonce).toBe(4);
    expect(contractAState).toEqual({_balance: '0', last_amount: '8'});
    expect(contractBState).toEqual({_balance: '0', last_amount: '4'});
    expect(contractCState).toEqual({_balance: '8', last_amount: '4'});
  });
});

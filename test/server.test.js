/**
 This file is part of kaya.
  Copyright (c) 2018 - present Zilliqa Research Pte. Ltd.

  kaya is free software: you can redistribute it and/or modify it under the
  terms of the GNU General Public License as published by the Free Software
  Foundation, either version 3 of the License, or (at your option) any later
  version.

  kaya is distributed in the hope that it will be useful, but WITHOUT ANY
  WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
  A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

  You should have received a copy of the GNU General Public License along with
  kaya.  If not, see <http://www.gnu.org/licenses/>.
* */

require('isomorphic-fetch');
const request = require('supertest');
const { Zilliqa } = require('@zilliqa-js/zilliqa');
const { BN, units } = require('@zilliqa-js/util');
const app = require('../src/app');
const config = require('../src/config');
const Provider = require('../src/provider');

const getZilliqa = () => {
  const provider = new Provider({ dataPath: 'data/' });
  return new Zilliqa(null, provider);
};

const makeQuery = (method, params) => ({
  id: '1',
  jsonrpc: '2.0',
  method,
  params: [params],
});


describe('Test the Server Connection', () => {
  test('It should respond to the GET method', (done) => {
    request(app.expressjs).get('/').then((response) => {
      expect(response.statusCode).toBe(200);
      done();
    });
  });
});

/* Server Connection Test */

describe('Test the Server Connection', () => {
  test('It should respond to network id', async (done) => {
    request(app.expressjs).post('/')
      .send(makeQuery('GetNetworkId', ''))
      .then((response) => {
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({ id: '1', jsonrpc: '2.0', result: '111' });
        done();
      });
  });
});

/* Balance Test */

const accounts = app.wallet.getAccounts();
const testAccount1 = Object.keys(accounts)[0];
const testAccount2 = Object.keys(accounts)[1];

describe('Server Initialization Tests', () => {
  test('Test Accounts generated should return the correct balance', async (done) => {
    request(app.expressjs).post('/')
      .send(makeQuery('GetBalance', testAccount1))
      .then((response1) => {
        expect(response1.statusCode).toBe(200);
        expect(response1.body).toEqual({ id: '1', jsonrpc: '2.0', result: { balance: config.wallet.defaultAmt.toString(), nonce: config.wallet.defaultNonce } });
        done();
      });
  });

  test('Uninitialized accounts should return the zero balance', async (done) => {
    request(app.expressjs).post('/')
      .send(makeQuery('GetBalance', '0'.repeat(40)))
      .then((response1) => {
        expect(response1.statusCode).toBe(200);
        expect(response1.body).toEqual({ error: { code: -5, data: null, message: 'Account is not created' }, id: '1', jsonrpc: '2.0' });
        done();
      });
  });

  test('Should have zero recent transactions', async (done) => {
    request(app.expressjs).post('/')
      .send(makeQuery('GetRecentTransactions', ''))
      .then((response) => {
        expect(response.statusCode).toBe(200);
        expect(response.body.result.number).toBe(0);
        done();
      });
  });
});

/* Check for presence of smart-contract related methods */

describe('Smart Contract related methods Tests', () => {
  test('GetSmartContracts should correctly return zero-address error', async (done) => {
    request(app.expressjs).post('/')
      .send(makeQuery('GetSmartContracts', '50e9247a39e87a734355a203666ff7415c8a0802'))
      .then((response) => {
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(
          { error: { code: -5, data: null, message: 'Address does not exist' }, id: '1', jsonrpc: '2.0' },
        );
        done();
      });
  });

  test('GetSmartContractInit should correctly return zero-address error', async (done) => {
    request(app.expressjs).post('/')
      .send(makeQuery('GetSmartContractInit', '50e9247a39e87a734355a203666ff7415c8a0802'))
      .then((response) => {
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(
          { error: { code: -5, data: null, message: 'Address does not exist' }, id: '1', jsonrpc: '2.0' },
        );
        done();
      });
  });

  test('GetSmartContractState should correctly return zero-address error', async (done) => {
    request(app.expressjs).post('/')
      .send(makeQuery('GetSmartContractState', '50e9247a39e87a734355a203666ff7415c8a0802'))
      .then((response) => {
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(
          { error: { code: -5, data: null, message: 'Address does not exist' }, id: '1', jsonrpc: '2.0' },
        );
        done();
      });
  });

  test('GetSmartContractCode should correctly return zero-address error', async (done) => {
    request(app.expressjs).post('/')
      .send(makeQuery('GetSmartContractCode', '50e9247a39e87a734355a203666ff7415c8a0802'))
      .then((response) => {
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(
          { error: { code: -5, data: null, message: 'Address does not exist' }, id: '1', jsonrpc: '2.0' },
        );
        done();
      });
  });
});

const getZilliqaBalance = async (zilliqa, address) => {
  const data = await zilliqa.blockchain.getBalance(address);
  return new BN(data.result.balance);
};

describe('Transaction Tests', () => {
  const zilliqa = getZilliqa();

  Object.keys(accounts).forEach((address) => {
    zilliqa.wallet.addByPrivateKey(
      accounts[address].privateKey,
    );
  });

  const getBalance = address => getZilliqaBalance(zilliqa, address);

  test('CreateTransaction success', async () => {
    const amount = units.toQa('333', units.Units.Zil);
    const account1balance = await getBalance(testAccount1);
    const account2balance = await getBalance(testAccount2);
    const t = await zilliqa.blockchain.createTransaction(
      zilliqa.transactions.new({
        version: 7274497,
        toAddr: testAccount2,
        amount,
        gasPrice: config.blockchain.minimumGasPrice,
        gasLimit: config.blockchain.minimumGasPrice.mul(new BN(2)),
      }),
    );
    expect(t.txParams.receipt.success).toBeTruthy();
    const gasPrice = t.txParams.gasPrice;
    const cumulativeGas = new BN(t.txParams.receipt.cumulative_gas);
    expect(await getBalance(testAccount1))
      .toEqual(account1balance.sub(amount).sub(gasPrice.mul(cumulativeGas)));
    expect(await getBalance(testAccount2)).toEqual(account2balance.add(amount));
  });
});

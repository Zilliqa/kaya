/* Transaction tests */

const BN = require('bn.js');
let { Zilliqa } = require('zilliqa-js');
const request = require('supertest');
const app = require('../app');
const config = require('../config');
require('isomorphic-fetch');

const makeQuery = (method, params) => { 
    return {
        "id": "1",
        "jsonrpc": "2.0",
        "method": method,
        "params": [params]
    }
}

let zilliqa = new Zilliqa({
    nodeUrl: 'http://localhost:4200'
})

const makeTxnDetailsP2P = (recipient, amount, nonce) => {
    let txnDetails = {
        version: 0,
        nonce: nonce,
        to: recipient ,
        amount: new BN(amount),
        gasPrice: config.testconfigs.gasPrice,
        gasLimit: config.testconfigs.gasLimit
    };
    return txnDetails;
}

/* P2P Transfer (aka payments type transaction) */
const accounts = app.wallet.getAccounts();
const alice = Object.keys(accounts)[0];
const bob = Object.keys(accounts)[1];
const originalAmt = config.wallet.defaultAmt;


describe.only('Testing (Alice ----100-----> Bob)', () => {
    console.log();

    test('Alice should have some balance', async (done) => {
        request(app.expressjs).post('/')
        .send(makeQuery("GetBalance", alice))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({"id": "1", "jsonrpc": "2.0", "result": {"balance": originalAmt, "nonce": config.wallet.defaultNonce}});
            done();
        });
    });

    // call is successful if a txn hash is returned
    test('P2P create transaction should return a txn hash', async (done) => {
        let pk_alice = accounts[alice]['privateKey'];
        let txnDetails = makeTxnDetailsP2P(bob, config.testconfigs.transferAmt, 1);
        let jsonQuery = zilliqa.util.createTransactionJson(pk_alice, txnDetails);
        jsonQuery.amount = config.testconfigs.transferAmt;
        request(app.expressjs).post('/')
        .send(makeQuery("CreateTransaction", jsonQuery))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body.result).toHaveLength(64);
            done();
        });
    });

    // Check Alice account
    test('Alice should have correct funds deducted from her account', async (done) => {
        const expected_bal = originalAmt - config.testconfigs.transferAmt - config.testconfigs.gasLimit;
       
        request(app.expressjs).post('/')
        .send(makeQuery("GetBalance", alice))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({"id": "1", "jsonrpc": "2.0", "result": {"balance": expected_bal, "nonce": config.wallet.defaultNonce + 1}});
            done();
        });
    });

    // Check Bob account
    test('Bob should have the correct funds added to his account', async (done) => {
        const expected_bal = originalAmt + config.testconfigs.transferAmt;
       
        request(app.expressjs).post('/')
        .send(makeQuery("GetBalance", bob))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({"id": "1", "jsonrpc": "2.0", "result": {"balance": expected_bal, "nonce": config.wallet.defaultNonce}});
            done();
        });
    });

});


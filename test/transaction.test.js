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
        gasPrice: 1,
        gasLimit: 10
    };
    return txnDetails;
}

/* P2P Transfer (aka payments type transaction) */
const accounts = app.wallet.getAccounts();
const alice = Object.keys(accounts)[0];
const bob = Object.keys(accounts)[1];

describe('Testing (Alice ----100-----> Bob)', () => {


    test('Alice should have some balance', async (done) => {
        request(app.expressjs).post('/')
        .send(makeQuery("GetBalance", alice))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({"id": "1", "jsonrpc": "2.0", "result": {"balance": config.wallet.defaultAmt, "nonce": config.wallet.defaultNonce}});
            done();
        });
    });

});


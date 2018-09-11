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
const charlie = Object.keys(accounts)[2];
const originalAmt = config.wallet.defaultAmt;
var pastTxn;


/*  Start */

describe('Testing (Alice ----100-----> Bob)', () => {
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
            expect(response.body.result).toBe('849bbfa5774336f4923a731ec9710a328ab9850fd5986d1aea8c33c0930fe717');
            pastTxn = response.body.result;
            done();
        });
    });

    test('Transaction hash should be retrievable with the correct details', async (done) => {
        request(app.expressjs).post('/')
        .send(makeQuery("GetTransaction", pastTxn))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body.result).toHaveProperty('ID');
            expect(response.body.result).toHaveProperty('amount');
            expect(response.body.result).toHaveProperty('senderPubKey');
            expect(response.body.result).toHaveProperty('nonce');
            expect(response.body.result).toHaveProperty('signature');
            expect(response.body.result).toHaveProperty('toAddr');
            expect(response.body.result).toHaveProperty('version');
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

/* 
    Test - Charlie sends zils to some random dude, Ranon, 
    who was not created through the server
*/
describe('Testing (Charlie ----100-----> Ranon)', () => {
    const ranon_addr = '7A8AC37E0BFD6D67E8908569814D724AC1C90DAE'; 

    test('Charlie should have some balance', async (done) => {
        request(app.expressjs).post('/')
        .send(makeQuery("GetBalance", charlie))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({"id": "1", "jsonrpc": "2.0", "result": {"balance": originalAmt, "nonce": config.wallet.defaultNonce}});
            done();
        });
    });

    // call is successful if a txn hash is returned
   
    test('Transaction should return a txn hash', async (done) => {
        let pk_charlie = accounts[charlie]['privateKey'];
        let txnDetails = makeTxnDetailsP2P(ranon_addr, config.testconfigs.transferAmt, 1);
        let jsonQuery = zilliqa.util.createTransactionJson(pk_charlie, txnDetails);
        jsonQuery.amount = config.testconfigs.transferAmt;
        request(app.expressjs).post('/')
        .send(makeQuery("CreateTransaction", jsonQuery))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body.result).toHaveLength(64);
            pastTxn = response.body.result;
            done();
        });
    });

    test('Transaction hash should be retrievable with the correct details', async (done) => {
        request(app.expressjs).post('/')
        .send(makeQuery("GetTransaction", pastTxn))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body.result).toHaveProperty('ID');
            expect(response.body.result).toHaveProperty('amount');
            expect(response.body.result).toHaveProperty('senderPubKey');
            expect(response.body.result).toHaveProperty('nonce');
            expect(response.body.result).toHaveProperty('signature');
            expect(response.body.result).toHaveProperty('toAddr');
            expect(response.body.result).toHaveProperty('version');
            done();
        });
    });



    // Check Alice account
    test('Charlie should have correct funds deducted from his account', async (done) => {
        const expected_bal = originalAmt - config.testconfigs.transferAmt - config.testconfigs.gasLimit;
       
        request(app.expressjs).post('/')
        .send(makeQuery("GetBalance", charlie))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({"id": "1", "jsonrpc": "2.0", "result": {"balance": expected_bal, "nonce": config.wallet.defaultNonce + 1}});
            done();
        });
    });

    // Check Ranon account
    test('Ranon should have account initialized and amount transferred', async (done) => {
        const expected_bal = config.testconfigs.transferAmt;
       
        request(app.expressjs).post('/')
        .send(makeQuery("GetBalance", ranon_addr))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({"id": "1", "jsonrpc": "2.0", "result": {"balance": expected_bal, "nonce": config.wallet.defaultNonce}});
            done();
        });
    });

});
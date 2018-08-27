const request = require('supertest');
const app = require('../app');
const config = require('../config');

const makeQuery = (method, params) => { 
    return {
        "id": "1",
        "jsonrpc": "2.0",
        "method": method,
        "params": [params]
    }
}


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
        .send(makeQuery("GetNetworkId", ""))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({"id":"1","jsonrpc":"2.0","result":"Testnet"});
            done();
        });
    });
});

/* Balance Test */

const accounts = app.wallet.getAccounts();
const testAccount1 = Object.keys(accounts)[0];

describe('Server Initialization Tests', () => {
    test('Test Accounts generated should return the correct balance', async (done) => {
        request(app.expressjs).post('/')
        .send(makeQuery("GetBalance", testAccount1))
        .then((response1) => {
            expect(response1.statusCode).toBe(200);
            expect(response1.body).toEqual({"id": "1", "jsonrpc": "2.0", "result": {"balance": config.wallet.defaultAmt, "nonce": config.wallet.defaultNonce}});
            done();
        });
    });

    test('Uninitialized accounts should return the zero balance', async (done) => {
        request(app.expressjs).post('/')
        .send(makeQuery("GetBalance", '0'.repeat(40)))
        .then((response1) => {
            expect(response1.statusCode).toBe(200);
            expect(response1.body).toEqual({"id": "1", "jsonrpc": "2.0", "result": {"balance": 0, "nonce": 0}});
            done();
        });
    });

    test('Should have zero recent transactions', async (done) => {
        request(app.expressjs).post('/')
        .send(makeQuery("GetRecentTransactions", ""))
        .then((response) => {
            expect(response.statusCode).toBe(200);
            expect(response.body.result.number).toBe(0);
            done();
        });
    });
});



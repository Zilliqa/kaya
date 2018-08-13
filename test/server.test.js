const request = require('supertest');
const app = require('../app')
describe('Test the Server Connection', () => {
    test('It should respond to the GET method', (done) => {
        request(app).get('/').then((response) => {
            expect(response.statusCode).toBe(200);
            done();
        });
    });
});
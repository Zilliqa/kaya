let { Zilliqa } = require('./lib/zilliqa');
//let config = require('./config')
//let url = config.test_scilla_explorer ? config.url_remotehost : config.url_localhost;
let fs = require('fs');
let argv = require('yargs').argv;
let colors = require('colors');

let zilliqa = new Zilliqa({
    nodeUrl: 'https://localhost:4200'
})

console.log('Zilliqa Testing Script'.bold.cyan);
let node = zilliqa.getNode();

node.getSmartContractState({ address: 'dac620855671af9dd39fc62c4631d97280ccbf29' }, function(err, data) {
    if (err || (data.result && data.result.Error)) {
        console.log(err)
    } else {
        console.log(data)
    }
})
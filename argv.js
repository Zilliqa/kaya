const config = require('./config');

module.exports = exports = function(yargs) {
    return yargs
        .strict()
        .usage('Usage: node $0 <cmd> [options]')
        .example('node server.js -f -v', 'Starts server based on predefined wallet files with verbose mode')
        .option('p', {
            group: 'Network',
            alias: 'port',
            type: 'number',
            default: config.port,
            describe: 'Port number to listen'
        })
        .option('d', {
            group: 'Blockchain',
            alias: 'data',
            type: 'string',
            default: config.dataPath,
            describe: 'Relative path where state data will be stored. Creates directory if path does not exists'
        })
        .option('r', {
            group: 'Blockchain',
            alias: 'remote',
            type: 'boolean',
            default: config.scilla.remote,
            describe: 'Option to use remote interpreter or local interpreter. True = remote'
        })
        .option('f', {
            group: 'Other',
            alias: 'fixtures',
            type: 'string',
            default: null,
            describe: 'Path to JSON file which contains the private keys to predefined set of wallets'
        })
        .option('n', {
            group: 'Other',
            alias: 'numAccounts',
            type: 'number',
            default: config.wallet.numAccounts,
            describe: 'Number of accounts to load at start up. Only used if fixtures file is not defined.'
        })
        .option('l', {
            group: 'Other',
            alias: 'load',
            type: 'string',
            default: null,
            describe: 'Load data files from a path'
        })
        .option('s', {
            group: 'Other',
            alias: 'save',
            type: 'boolean',
            default: null,
            describe: 'Saves data by the end of the session'
        })
        .option('v', {
            group: 'Other',
            alias: 'verbose',
            type: 'boolean',
            default: false,
            describe: 'Log messages to console to stdout'
        })
        .showHelpOnFail(false, 'Specify --help for available options')
        .help('help')
        .alias('help', '?')
        .version(config.version)
}

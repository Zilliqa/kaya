#!/usr/bin/env node
/*
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
*/

const yargs = require('yargs');

const config = require('./config');
const initArgv = require('./argv');

let serverPort;
let argv;
if (process.env.NODE_ENV !== 'test') {
  argv = initArgv(yargs).argv;
  serverPort = argv.p ? argv.p : config.port;
} else {
  console.log('-------- TEST MODE -------------');
  argv = config.testconfigs.args;
}

/* Information about Kaya RPC Server */

console.log(`ZILLIQA KAYA RPC SERVER (ver: ${config.version})`);
console.log(`Server listening on 127.0.0.1:${serverPort}`);

const app = require('./app');

const server = app.expressjs.listen(serverPort, (err) => {
  if (err) {
    process.exit(1);
  }
});

// Listener for connections opening on the server
let connections = [];
server.on('connection', (connection) => {
  connections.push(connection);
  connection.on(
    'close',
    () => (connections = connections.filter(curr => curr !== connection)),
  );
});

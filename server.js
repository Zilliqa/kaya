/*
 This file is part of kaya.
  Copyright (c) 2018 - present Zilliqa Research Pvt. Ltd.

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

let colors = require('colors')

const config = require('./config')
const app = require('./app')

const { port } = config

console.log(`Zilliqa kaya Server (ver: ${config.version})`.cyan)
console.log(`\nServer listening on 127.0.0.1:${port}`.yellow)

const server = app.expressjs.listen(port, err => {
  if (err) {
    process.exit(1)
  }
})

// Listener for connections opening on the server
let connections = []
server.on('connection', connection => {
  connections.push(connection)
  connection.on(
    'close',
    () => (connections = connections.filter(curr => curr !== connection))
  )
})

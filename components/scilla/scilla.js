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

const fs = require('fs')
const LOG_SCILLA = require('debug')('kaya:scilla')
const { promisify } = require('util')
const { exec } = require('child_process')

const utilities = require('../../utilities')
const config = require('../../config')

const blockchainPath = 'tmp/blockchain.json'
const colors = require('colors')

const execAsync = promisify(exec)

function pad(number, length) {
  var str = '' + number
  while (str.length < length) {
    str = '0' + str
  }
  return str
}

Date.prototype.YYYYMMDDHHMMSS = function() {
  var yyyy = this.getFullYear().toString()
  var MM = pad(this.getMonth() + 1, 2)
  var dd = pad(this.getDate(), 2)
  var hh = pad(this.getHours(), 2)
  var mm = pad(this.getMinutes(), 2)
  var ss = pad(this.getSeconds(), 2)

  return yyyy + MM + dd + hh + mm + ss
}

const makeBlockchainJson = val => {
  const blockchainData = [
    {
      vname: 'BLOCKNUMBER',
      type: 'BNum',
      value: val.toString(),
    },
  ]
  fs.writeFileSync(blockchainPath, JSON.stringify(blockchainData))
  LOG_SCILLA(`blockchain.json file prepared for blocknumber: ${val}`)
}

const initializeContractState = amt => {
  const initState = [
    {
      vname: '_balance',
      type: 'Uint128',
      value: amt.toString(),
    },
  ]
  return initState
}

const runLocalInterpreterAsync = async (command, outputPath) => {
  LOG_SCILLA('Running local scilla interpreter (Sync)')
  // Run Scilla Interpreter
  if (!fs.existsSync(config.scilla.runner_path)) {
    LOG_SCILLA(
      'Scilla runner not found. Hint: Have you compiled the scilla binaries?'
    )
    throw new Error('Kaya RPC Runtime Error: Scilla-runner not found')
  }

  const result = await execAsync(command)
  if (result.stderr !== '') {
    throw new Error(`Interpreter error: ${result.stderr}`)
  }

  LOG_SCILLA('Scilla execution completed')

  const retMsg = JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
  return retMsg
}

module.exports = {
  executeScillaRun: async (payload, address, dir, currentBnum, gasLimit) => {
    // Get the blocknumber into a json file
    makeBlockchainJson(currentBnum)

    let isCodeDeployment = payload.code && payload.to === '0'.repeat(40)
    const contractAddr = isCodeDeployment ? address : payload.to

    const initPath = `${dir}${contractAddr}_init.json`
    const codePath = `${dir}${contractAddr}_code.scilla`
    const outputPath = `tmp/${contractAddr}_out.json`
    const statePath = `${dir}${contractAddr}_state.json`

    let cmd = `${
      config.scilla.runner_path
    } -iblockchain ${blockchainPath} -o ${outputPath} -init ${initPath} -i ${codePath} -gaslimit ${gasLimit}`
    console.log(cmd);

    if (isCodeDeployment) {
      LOG_SCILLA('Code Deployment')

      // initialized with standard message template
      isCodeDeployment = true

      // get init data from payload
      const initParams = JSON.stringify(payload.data)
      const cleanedParams = utilities.paramsCleanup(initParams)
      fs.writeFileSync(initPath, cleanedParams)

      const rawCode = JSON.stringify(payload.code)
      const cleanedCode = utilities.codeCleanup(rawCode)
      fs.writeFileSync(codePath, cleanedCode)
    } else {
      LOG_SCILLA(`Calling transition within contract ${payload.to}`)

      LOG_SCILLA(`Code Path: ${codePath}`)
      LOG_SCILLA(`Init Path: ${initPath}`)
      if (!fs.existsSync(codePath) || !fs.existsSync(initPath)) {
        // tocheck what is the expected behavior on jsonrpc
        LOG_SCILLA('Error, contract has not been created.')
        throw new Error('Address does not exist')
      }

      // get message from payload information
      const msgPath = `${dir}${payload.to}_message.json`
      LOG_SCILLA('Payload Received %O', payload.data)
      const incomingMessage = JSON.stringify(payload.data)
      const cleanedMsg = utilities.paramsCleanup(incomingMessage)
      fs.writeFileSync(msgPath, cleanedMsg)

      // Invoke contract requires additional message and state paths
      cmd = `${cmd} -imessage ${msgPath} -istate ${statePath}`
    }

    if (!fs.existsSync(codePath) || !fs.existsSync(initPath)) {
      LOG_SCILLA('Error, contract has not been created.')
      throw new Error('Address does not exist')
    }

    const retMsg = await runLocalInterpreterAsync(cmd, outputPath)

    // Extract state from tmp/out.json
    let newState = JSON.stringify(retMsg.states)
    if (isCodeDeployment) {
      newState = JSON.stringify(initializeContractState(payload.amount))
    }

    fs.writeFileSync(statePath, newState)
    LOG_SCILLA(`State logged down in ${statePath}`)
    console.log(`Contract Address Deployed: ${contractAddr}`)

    responseData = {};
    responseData.gasRemaining = retMsg.gas_remaining;

    // get the error message log
    if (retMsg.message != null) {
      LOG_SCILLA(`Next address: ${retMsg.message._recipient}`)
      responseData.nextAddress = retMsg.message._recipient
    }
    // Contract deployment runs do not have returned message
    responseData.nextAddress = '0'.repeat(40);
    console.log(responseData);

    return responseData;
  },
}

const zCore = require('@zilliqa-js/core');
const logic = require('./logic');
const wallet = require('./components/wallet/wallet');
const config = require('./config');
const { RPCError } = require('./components/CustomErrors');

const errorCodes = zCore.RPCErrorCode;

class Provider {
  constructor(options) {
    this.options = options;
    this.middleware = {
      request: {
        use: () => {},
      },
      response: {
        use: () => {},
      },
    };
  }

  /**
   * Process the JSON RPC call
   * @async
   * @param { String } method - Zilliqa RPC method name
   * @param { Array } params - Zilliqa RPC method parameters
   * @returns { Promise<Object> } - returned parameters
   */
  async send(method, ...params) {
    try {
      const result = await this.rpcResponse(method, ...params);
      return { result };
    } catch (err) {
      return {
        error: {
          code: err.code,
          data: err.data,
          message: err.message,
        },
      };
    }
  }

  /**
   * Returns RPC response.
   *
   * @private
   * @async
   * @param { String } method - Zilliqa RPC method name
   * @param { Array } params - Zilliqa RPC method parameters
   * @returns { Object } - returned parameters
   */
  async rpcResponse(method, ...params) {
    switch (method) {
      case 'GetBalance': {
        const paramAddr = params[0];
        const addr = typeof paramAddr === 'object'
          ? JSON.stringify(paramAddr)
          : paramAddr;
        return wallet.getBalance(addr);
      }
      case 'GetNetworkId':
        return config.chainId.toString();
      case 'GetSmartContractCode':
        return logic.processGetDataFromContract(params, this.options.dataPath, 'code');
      case 'GetSmartContractState':
        return logic.processGetDataFromContract(params, this.options.dataPath, 'state');
      case 'GetSmartContractInit':
        return logic.processGetDataFromContract(params, this.options.dataPath, 'init');
      case 'GetSmartContracts':
        return logic.processGetSmartContracts(params, this.options.dataPath);
      case 'CreateTransaction':
        return logic.processCreateTxn(params, this.options.dataPath);
      case 'GetTransaction':
        return logic.processGetTransaction(params);
      case 'GetRecentTransactions':
        return logic.processGetRecentTransactions();
      case 'GetContractAddressFromTransactionID':
        return logic.processGetContractAddressByTransactionID(params);
      case 'GetMinimumGasPrice':
        return config.blockchain.minimumGasPrice.toString();
      default:
        throw new RPCError(
          'METHOD_NOT_FOUND: The method being requested is not available on this server',
          errorCodes.RPC_INVALID_REQUEST,
          null,
        );
    }
  }
}

module.exports = Provider;

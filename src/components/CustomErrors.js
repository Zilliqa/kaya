const zCore = require('@zilliqa-js/core')
const errorCodes = zCore.RPCErrorCode;

class InterpreterError extends Error {
    constructor(message) {
        super(message);
        this.name = "InterpreterError";
    }
}

class BalanceError extends Error {
    constructor(message) {
        super(message);
        this.name = "BalanceError";
        this.code = errorCodes.RPC_INVALID_ADDRESS_OR_KEY,
        this.data = null
    }
}

// Cast all RPC errors to this error class
// Reference: https://github.com/Zilliqa/Zilliqa/blob/master/src/libServer/Server.cpp
class RPCError extends Error {
    constructor(message, errCode, errData) {
        super(message);
        this.name = "RPCError";
        this.code = errCode,
        this.data = errData
    }
}

class MultiContractError extends Error {
    constructor(message) {
        super(message);
        this.name = "MulticontractError";
    }
}

class InsufficientGasError extends Error {
    constructor(message) {
        super(message);
        this.name = "InsufficientGasError";
    }
}

module.exports = {
    InterpreterError: InterpreterError,
    BalanceError : BalanceError,
    MultiContractError : MultiContractError,
    InsufficientGasError : InsufficientGasError,
    RPCError: RPCError
}
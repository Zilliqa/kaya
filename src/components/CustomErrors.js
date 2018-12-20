const errorCode = require('../ErrorCodes');

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
        this.code = errorCode.RPC_INVALID_ADDRESS_OR_KEY,
        this.data = null
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
    InsufficientGasError : InsufficientGasError
}
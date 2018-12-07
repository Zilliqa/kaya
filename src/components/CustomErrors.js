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
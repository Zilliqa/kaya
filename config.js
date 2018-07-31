const config = module.exports = {}

// blockchain specific configuration
config.blockchain = {
    // sets timer for the block confirmation
    blockInterval: 10000,    // 10000 = 10 seconds for one block
    blockStart: 0
}
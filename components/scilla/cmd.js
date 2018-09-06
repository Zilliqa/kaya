const {exec} = require('child_process');
const {fs} = require('fs');

module.exports.asyncfunc = () => {
    console.log('in async function');

        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                console.log('timeout')
                resolve('ddd');
            }, 5000)
        })
}

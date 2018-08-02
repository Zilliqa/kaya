
/**
* Copyright (c) 2018 Zilliqa 
* This source code is being disclosed to you solely for the purpose of your participation in 
* testing Zilliqa. You may view, compile and run the code for that purpose and pursuant to 
* the protocols and algorithms that are programmed into, and intended by, the code. You may 
* not do anything else with the code without express permission from Zilliqa Research Pte. Ltd., 
* including modifying or publishing the code (or any part of it), and developing or forming 
* another public or private blockchain network. This source code is provided ‘as is’ and no 
* warranties are given as to title or non-infringement, merchantability or fitness for purpose 
* and, to the extent permitted by law, all liability for your use of the code is disclaimed. 
* Some programs in this code are governed by the GNU General Public License v3.0 (available at 
* https://www.gnu.org/licenses/gpl-3.0.en.html) (‘GPLv3’). The programs that are governed by 
* GPLv3.0 are those programs that are located in the folders src/depends and tests/depends 
* and which include a reference to GPLv3 in their program files.
**/


var fs = require('fs');
module.exports = {
    removeComments: (str) => {
        var originalStr = str
        var commentStart
    
        try {
          // loop till all comments beginning with '(*' are removed
          while (commentStart = str.match(/\(\*/)) {
            // get the string till comment start
            var str1 = str.substr(0, commentStart.index)
    
            // get the string after comment start
            var str2 = str.substr(commentStart.index)
            var commentEnd = str2.match(/\*\)/)
            var str3 = str2.substr(commentEnd.index + 2)
    
            str = str1 + str3
          }
        } catch (e) {
          return originalStr
        }
        return str
    },

    codeCleanup: (str) => {
      cleanedCode = module.exports.removeComments(str);
      cleanedCode = cleanedCode.replace(/\\n/g, ' ').replace(/\\"/g, '"');
      cleanedCode = cleanedCode.substring(1, cleanedCode.length-1);
      return cleanedCode;
    },

    paramsCleanup: (initParams) => {
      cleaned_params = initParams.trim();
      cleaned_params = cleaned_params.substring(1, cleaned_params.length-1)
      .replace(/\\"/g, '"');
      return cleaned_params
    }
    
}
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
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

module.exports = {
  removeComments: str => {
    let commentStart;
    let commentEnd;
    let str1;
    let str2;
    let str3;
    const originalStr = str;

    try {
      // loop till all comments beginning with '(*' are removed
      while ((commentStart = str.match(/\(\*/))) {
        // get the string till comment start
        str1 = str.substr(0, commentStart.index);

        // get the string after comment start
        str2 = str.substr(commentStart.index);
        commentEnd = str2.match(/\*\)/);
        str3 = str2.substr(commentEnd.index + 2);

        str = str1 + str3;
      }
    } catch (e) {
      return originalStr;
    }
    return str;
  },

  codeCleanup: str => {
    let cleanedCode = module.exports.removeComments(str);
    cleanedCode = cleanedCode.replace(/\\n|\\t/g, ' ').replace(/\\"/g, '"');
    cleanedCode = cleanedCode.substring(1, cleanedCode.length - 1);
    return cleanedCode;
  },

  paramsCleanup: initParams => {
    let cleanedParams = initParams.trim();
    cleanedParams = cleanedParams
      .substring(1, cleanedParams.length - 1)
      .replace(/\\"/g, '"');
    return cleanedParams;
  },
};

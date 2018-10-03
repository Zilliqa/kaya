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

const fs = require('fs');
const moment = require('moment');
const yargs = require('yargs');
const init = require('./argv');
const glob = require('glob');
const argv = init(yargs).argv;
const logLabel = 'Utilities';

module.exports = {

  // Called by the app.js
  getDataFromDir: (dataPath, fileExt) => {
    files = glob.sync(`${dataPath}*_${fileExt}`);
    const result = {};
    const isCode = (fileExt === 'code.scilla');
    files.forEach((file) => {
      fileData = fs.readFileSync(file, 'utf-8');
      result[file.slice(dataPath.length)] = isCode ? fileData : JSON.parse(fileData);
    });
    return result;
  },

  /*
  * Called when the user chooses to load from an existing file 
  */
  loadData: (filePath) => {
    // FIXME : Validate the file
    const data = JSON.parse(fs.readFileSync(filePath));
    return data;
  },

  // log function that logs only when verbose mode is on
  logVerbose: (src, msg) => {
    if (argv.v) {
      console.log(`[${src}]\t : ${msg}`);
    }
  },

  // wrapper: print only when not in test mode
  consolePrint: (text) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(text);
    }
  },

  /*
  * @returns : { string } : Datetime format (e.g. 20181001T154832 )
  */
  getDateTimeString: () => {
    return moment().format('YYYYMMDD_hhmmss');
  },

  /*
  * Given a piece of scilla code, removes comments
  * @param : { string } : scilla code
  * @returns : { string } : scilla code without comments
  */
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

  /* prepareDirectories : Called by app.js */
  prepareDirectories: (dataPath) => {
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath);
      module.exports.logVerbose(logLabel, `${__dirname}/${dataPath} created`);
    }
  }
};

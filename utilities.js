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
const glob = require('glob');
const yargs = require('yargs');
const initArgv = require('./argv');
const config = require('./config');


// Configure the argument flags based on test environment
let argv;
if (process.env.NODE_ENV !== 'test') {
  argv = initArgv(yargs).argv;
} else {
  argv = config.testconfigs.args;
}

const logLabel = 'Utilities';

module.exports = {

  /**
  * Utility function to extract data from the working directory
  * according to file extension (called from app.js)
  * @param: { String } dataPath - Path to the working directory
  * @param : { String } fileExtension - One of the following:
  *           { code.scilla, state.json, init.json}
  * @returns : { Object } - Data object for the specified file extension
  */
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

  /**
  * Called when the user chooses to load from an existing file 
  * @param: { string } filepath to directory
  */
  loadData: (filePath) => {
    // FIXME : Validate the file
    const data = JSON.parse(fs.readFileSync(filePath));
    return data;
  },

  /*
  * Writes the data files from the saved session into the working directory 
  * @params : { String } dataPath - Path to the working data directory
  * @params : { Object } data - Object that includes the init, code and state files
  */
  loadDataToDir: (dataPath, data) => {
    const states = data.states;
    const stateFileNames = Object.keys(states);
    stateFileNames.forEach((file) => { 
      fs.writeFileSync(`${dataPath}/${file}`, JSON.stringify(states[file]));
    });
    module.exports.logVerbose(logLabel, `State files loaded into ${dataPath}`);

    const inits = data.init;
    const initFileNames = Object.keys(inits);
    initFileNames.forEach((file) => { 
      fs.writeFileSync(`${dataPath}/${file}`, JSON.stringify(inits[file]));
    });
    module.exports.logVerbose(logLabel, `Init files loaded into ${dataPath}`);

    const codes = data.codes;
    const codeFileNames = Object.keys(codes);
    codeFileNames.forEach((file) => { 
      fs.writeFileSync(`${dataPath}/${file}`, codes[file]);
    });
    module.exports.logVerbose(logLabel, `Code files loaded into ${dataPath}`);

  },

  // log function that logs only when verbose mode is on
  logVerbose: (src, msg) => {
    if(argv.v && process.env.NODE_ENV !== 'test') {
      console.log(`[${src}]\t : ${msg}`);
    }
  },

  // wrapper: print only when not in test mode
  consolePrint: (text) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(text);
    }
  },

  /**
  * @returns : { string } : Datetime format (e.g. 20181001T154832 )
  */
  getDateTimeString: () => {
    return moment().format('YYYYMMDD_hhmmss');
  },

  /**
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

  /*
  * Clean up the code received from POST requests. Converts raw code from editor
  * into format that can be read by the interpreter
  */
  codeCleanup: str => {
    let cleanedCode = module.exports.removeComments(str);
    cleanedCode = cleanedCode.replace(/\\n|\\t/g, ' ').replace(/\\"/g, '"');
    cleanedCode = cleanedCode.substring(1, cleanedCode.length - 1);
    return cleanedCode;
  },

  /*
  * Clean up the incoming message from POST requests
  */
  paramsCleanup: initParams => {
    let cleanedParams = initParams.trim();
    cleanedParams = cleanedParams
      .substring(1, cleanedParams.length - 1)
      .replace(/\\"/g, '"');
    return cleanedParams;
  },

  /** 
   * prepareDirectories: Prepare the directories required
   * @param: { String } dataPath : Full path to file
   */
  prepareDirectories: (dataPath) => {
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath);
      module.exports.logVerbose(logLabel, `${__dirname}/${dataPath} created`);
    }
  }
};

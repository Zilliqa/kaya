/**
 This file is part of testrpc.
  Copyright (c) 2018 - present Zilliqa Research Pvt. Ltd.
  
  testrpc is free software: you can redistribute it and/or modify it under the
  terms of the GNU General Public License as published by the Free Software
  Foundation, either version 3 of the License, or (at your option) any later
  version.
 
  testrpc is distributed in the hope that it will be useful, but WITHOUT ANY
  WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
  A PARTICULAR PURPOSE.  See the GNU General Public License for more details.
 
  You should have received a copy of the GNU General Public License along with
  testrpc.  If not, see <http://www.gnu.org/licenses/>.
**/

/* Configuration file */
/* Feel free to add more things to this file that will help you in development */


const config = module.exports = {}

// blockchain specific configuration
config.blockchain = {
    // sets timer for the block confirmation
    blockInterval: 10000,    // 10000 = 10 seconds for one block
    blockStart: 0
}
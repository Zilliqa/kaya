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


// @note: Query calls are best done using simple post requests since no signing
// mechanism is required
// Link: https://apidocs.zilliqa.com/#introduction

require('isomorphic-fetch');
const { Zilliqa } = require('zilliqa-js');

const zilliqa = new Zilliqa({
  nodeUrl: 'http://localhost:4200',
});

console.log('Zilliqa Testing Script');
const node = zilliqa.getNode();

node.getSmartContractState({ address: 'dac620855671af9dd39fc62c4631d97280ccbf29' }, (err, data) => {
  if (err || (data.result && data.result.Error)) {
    console.log(err);
  } else {
    console.log(data);
  }
});

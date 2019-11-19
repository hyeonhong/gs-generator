
// load common module
const { get, post, sleep, getToday, getDate } = require('../lib/common.js');

// load db module
const db = require('../lib/db.js');

// for decryption
const AES = require('../lib/crypto_Kross.js');


async function main() {
  let sleepPeriod = 5000;
  await sleep(sleepPeriod);
  throw new Error('test error message');
  return { resultMessage: 'success after ' + sleepPeriod / 1000 + ' seconds' };
}

module.exports = {
  main
}

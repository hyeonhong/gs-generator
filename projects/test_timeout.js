
// load common module
const { get, post, sleep, getToday, getDate } = require('../lib/common.js');

// load db module
const db = require('../lib/db.js');

// for decryption
const AES = require('../lib/crypto_Kross.js');


async function main(ms) {
  // sleepPeriod = 65000;
  let sleepPeriod = ms;
  await sleep(sleepPeriod);
  return { resultMessage: 'success after ' + sleepPeriod / 1000 + ' seconds' };
}

module.exports = {
  main
}

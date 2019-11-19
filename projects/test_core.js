// load common module
const { get, post, sleep, getToday, getDate, getWeightedAvg, addDashDate } = require('../lib/common.js');

// load db module
const db = require('../lib/db.js');

const moment = require('moment');

async function main(data) {

  // query table: products
  var form = {
    code: 'eq.' + 'EB:1299',
  };
  let products = await db.fetchCore('products', form);
  console.log('products start');
  console.log(products);
  console.log('products end');

  // query table: deposits
  var form = {
    member_no: 'eq.' + 57,
  };
  let deposits = await db.fetchCore('deposits', form);
  console.log('deposits start');
  console.log(deposits);
  console.log('deposits end');

  // query table: notes
  var form = {
    product_code: 'eq.' + 'EB:245',
  };
  let notes = await db.fetchCore('notes', form);
  console.log('notes start');
  console.log(notes.length);
  console.log('notes end');

  return { success: true };
}


module.exports = {
  main
}

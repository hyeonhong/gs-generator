// load common module
const { get, post, sleep, getToday, getDate } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');

async function main(message) {
  console.log('this is the message received inside: ' + message);
  // query table: ups_info
  var form = {
    select: 'no, due_dt, out_dt, out_mny',
    out_dt: 'eq.' + message,
    sta: 'eq.Y',
  };
  let upsInfo = await db.fetch('ups_info', form);

  // query table: inv_income_return
  var form = {
    select: 'erp_inv_info_no, trade_book_no, return_origin',
  };
  let invIncomeReturn = await db.fetch('inv_income_return', form);


  console.log(upsInfo);
  return upsInfo;
}


// receive message from master process
process.on('message', async (msg) => {
  if (msg === 'shutdown') {
    process.exit();
  } else {
    let payload = await main(msg);
    process.send(payload);
  }
});


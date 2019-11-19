function main() {
  // Load sheetsAPI library
  const { sheetConfig, read, copySheet, clear } = require('../lib/sheetsAPIs.js');

  // set up the google sheet configuration
  let krossId = '31';
  let spreadsheetId = '1MRKyin0x3V50Vl0_b5VvLevQ-ohK9twnyFZaBVPGgsg';
  sheetConfig(krossId, spreadsheetId);

  ///// read()
  // let range = 'main!A1:H9';
  // let result = read(range);
  // console.log(`the end`);
  // console.log(result.values);

  // ///// copySheet()
  // let gid = 0;
  // let result = copySheet(gid);
  // console.log(`the end`);

  ///// clear()
  let range = 'what';
  let result = clear(range);
  console.log(`the end`);
  console.log(result);

  return result;
}

module.exports = {
  main
}

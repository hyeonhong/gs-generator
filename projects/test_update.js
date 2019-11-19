function main() {

  // Load sheetsAPI library
  const { sheetConfig, update } = require('../lib/sheetsAPIs.js');

  // set up the google sheet configuration
  let krossId = '31';
  let spreadsheetId = '1MRKyin0x3V50Vl0_b5VvLevQ-ohK9twnyFZaBVPGgsg';
  sheetConfig(krossId, spreadsheetId);

  // create data
  let range = 'Sheet1!A1:H9';
  let arrayData = [
    ['hi', 'update', 'only']
    // ['second']
  ];

  // write to google sheet
  let result = update(range, arrayData);

  console.log(`the end`);
  console.log(result);
}

module.exports = {
  main
}

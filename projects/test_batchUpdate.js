function main() {
  // Load sheetsAPI library
  const { sheetConfig, batchUpdate } = require('../lib/sheetsAPIs.js');

  // set up the google sheet configuration
  let krossId = '31';
  let spreadsheetId = '1MRKyin0x3V50Vl0_b5VvLevQ-ohK9twnyFZaBVPGgsg';
  sheetConfig(krossId, spreadsheetId);

  // create data to be written
  let rangeSheet1 = 'Sheet1!A1:H9';
  let valuesSheet1 = [
    ['hi', 'sheet1', 'world']
    // ['second']
  ];

  let rangeMain = 'main!A1:H9';
  let valuesMain = [
    ['hi', 'main', 'world']
    // ['second']
  ];

  let requestData = [
    {
      range: rangeSheet1,
      majorDimension: 'ROWS',
      values: valuesSheet1
    },
    {
      range: rangeMain,
      majorDimension: 'ROWS',
      values: valuesMain
    }
  ];

  // write to google sheet
  let result = batchUpdate(requestData);

  console.log(`the end`);
  console.log(result);
}

module.exports = {
  main
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}




// const spreadsheetId = '1MRKyin0x3V50Vl0_b5VvLevQ-ohK9twnyFZaBVPGgsg';
// let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
// let arrayData = [
//   ['what', 'is ', 'this', 'annoying', 'sound'],
//   ['tell me']
// ];

// let payload = {
//   valueInputOption: 'USER_ENTERED',
//   data: [
//     {
//       range: 'main!A1:H9',
//       majorDimension: 'ROWS',
//       values: arrayData
//     }
//   ]
// }


// let responseBody = post(url, payload);
// console.log(responseBody);


// async function post(url, payload) {
//   const rp = require('request-promise');  // npm i request request-promise

//   let options = {
//     method: 'POST',
//     uri: url,
//     body: payload,
//     json: true  // JSON.stringify(body);
//   };

//   let responseBody;
//   await rp(options)
//     .then(function (parsedBody) {
//       response = parsedBody;
//     })
//     .catch(function (err) {
//       console.log(err);
//     });

//   return responseBody;
// }

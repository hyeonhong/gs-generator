const spreadsheetId = '1MRKyin0x3V50Vl0_b5VvLevQ-ohK9twnyFZaBVPGgsg';
let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;

let arrayData = [
  ['what', 'is ', 'this', 'annoying', 'sound'],
  ['tell me']
];

let payload = {
  valueInputOption: 'USER_ENTERED',
  data: [
    {
      range: 'main!A1:H9',
      majorDimension: 'ROWS',
      values: arrayData
    }
  ]
}


let responseBody = post(url, payload);
console.log(responseBody);


async function post(url, payload) {
  const rp = require('request-promise');  // npm i request request-promise

  let options = {
    method: 'POST',
    uri: url,
    body: payload,
    json: true  // JSON.stringify(body);
  };

  let responseBody;
  await rp(options)
    .then(function (parsedBody) {
      response = parsedBody;
    })
    .catch(function (err) {
      console.log(err);
    });

  return responseBody;
}

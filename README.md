# Google Sheets Generator

## Installation

- If Ansible is not installed:

`brew install ansible`

- Clone this repository to your local computer

`git clone https://github.com/ninetydays/gs-generator.git`

- Install npm packages

```
cd gs-generator
npm i
```

- Create .env file at repository's root folder and configure the current environment

```
echo 'GS_ENV=local' >> .env  # value of GS_ENV can be local, prod, dev, dev2, dev3, etc..
```

- To deploy to AWS servers, set the path of AWS key file(.pem) in deploy/hosts

```
vi deploy/hosts

# modify the following variable
ansible_ssh_private_key_file==/Users/{Your Username}/{Your path to AWS key file}
```

## Deployment

| Env        | Domain                                    | IP Address            | Command              |
| ---------- | ----------------------------------------- | --------------------- | -------------------- |
| production | https://report.example.com/               | 10.28.7.99            | npm run deploy_prod  |
| as         | http://as.example.com:7999/svc/report/    | 10.28.7.(137,197,173) | npm run deploy_as    |
| dev        | http://bdrd.example.com/svc/report/       | 10.28.3.199           | npm run deploy_dev   |
| dev2       | https://bdrd2.example.com/svc/report/     | 10.28.3.247           | npm run deploy_dev2  |
| dev3       | https://bdrd3.example.com/svc/report/     | 10.28.3.250           | npm run deploy_dev3  |
| dev4       | https://prx4.example.com/dev4/svc/report/ | 10.28.3.231           | npm run deploy_dev4  |
| stage      | unknown                                   | 10.28.7.248           | npm run deploy_stage |
| purple     | https://kd-purple.example.com/            | 207.148.105.111       | npm run deploy_vultr |
| local      | localhost                                 | N/A                   | npm run deploy_local |
| all        | N/A                                       | N/A                   | npm run deploy_all   |

For local use, you must set your local path in the deploy_local.yml

## Usage

### 1. Create your own project

- Decide the name for your project. For example, set **sample_project** as your project name.

- Create a js file of your project name under projects directory

```
touch ./projects/sample_project.js
```

Example:

```js
// load common module
const { get, post, sleep, getToday, getDate } = require('../lib/common.js');

// load db module
const db = require('../lib/db.js');

async function main(date) {
  // query table: erp_contract_info
  var form = {
    select: 'ups_no, total_loan_mny, out_dt',
    sta: 'eq.E'
  };
  let erpContractInfo = await db.fetch('erp_contract_info', form);

  let payload = [];
  let header = ['상품번호', '대출금액', '대출일자'];
  payload.push(header);
  for (const record of erpContractInfo) {
    let item = [record.ups_no, record.total_loan_mny, record.out_dt];
    payload.push(item);
  }

  console.log(payload);
  return payload;
}

module.exports = {
  main
};
```

Caveats:

- Must have main() function.
- main() function must be exported.
- main() must return the array of arrays.
- You must have the read/write permission for the spreadsheet you want to edit.

### 2. Test your code locally

```
node run sample_project
```

### 3. Deploy to the report server

```
npm run deploy_dev
```

### 4. Configure the Google Apps Script

- Open the Apps Script by clicking **Script Editor** under Tools on the target spreadsheet.

- Once opened, set a name for Apps Script.

- Click **Advanced Google Services** under Resources, and enable the Google Sheets V4.

- Click **Project Properties** under File and copy the **Script ID**.

- Open the terminal and execute the following command.

```
cd apps_script
mkdir sheet_name  # create the directory for apps script, name can be of your choice
cd sheet_name
npx clasp clone {Script ID}  # paste the Script ID copied from above
```

- After the above execution, 3 files get created. (Code.js, appsscript.json, .clasp.json)

- Modify the file **Code.js** at your need.

Example code for Code.js

```js
function myFunction() {
  var json = {
    token: 'qnS6rcndpS14-coHmwBhuSJ6OzlZ3AhZGbr0VS8VnNo=',
    projectName: 'summary2018'
  };
  var responseBody = post(json);
  Logger.log(responseBody);
}

function post(json) {
  var url = 'https://report.example.com';

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(json)
  };

  var response = UrlFetchApp.fetch(url, options);
  return response.getContentText();
}
```

#### POST request API

JSON body

```
{
    token: 'qnS6rcndpS14-coHmwBhuSJ6OzlZ3AhZGbr0VS8VnNo=',  // string, required
    projectName: '',  // string, required
    data: {}  // object, optional
}
```

### 5. Upload Google Apps Script

- Open the terminal and go to the directory where Code.js resides.

- Execute the following command.

```
npx clasp push
```

- For continuous work, execute the command below for the changes to be applied instantly.

```
npx clasp push  --watch
```

## Custom Libraries

&#x1F4D8; Functions in lib/db.js:

| Function Name  | Parameter          | Description                                         |
| -------------- | ------------------ | --------------------------------------------------- |
| fetch          | tableName, urlForm | Fetch a single table. save_sta = 'Y' set by default |
| fetchRaw       | tableName, urlForm | Fetch a single table. No option is set in advance   |
| multiFetch     | param              | Fetch multiple tables simultaneously                |
| validateMember | memberNo           | Check if the memberNo is valid                      |

&#x1F4D8; Functions in lib/common.js:

| Function Name | Parameter    | Description                                       |
| ------------- | ------------ | ------------------------------------------------- |
| get           | url, qs=null | HTTP GET request                                  |
| post          | url, payload | HTTP POST request                                 |
| sleep         | ms           | Wait for the given period of time (micro seconds) |
| getToday      |              | Get today's date in the form of 'yyyymmdd'        |

&#x1F4D8; Functions in lib/sheetsAPIs.js: --> no longer used

| Function Name | Parameter              | Description                              |
| ------------- | ---------------------- | ---------------------------------------- |
| sheetConfig   | krossId, spreadsheetId | Set up the sheet's configuration         |
| read          | range                  | Read data from a sheet                   |
| update        | range, arrayData       | Write data to a single range in a sheet  |
| batchUpdate   | requestData            | Write data to multiple ranges in a sheet |
| clear         | range                  | Clear values from a sheet                |
| copySheet     | gid                    | Copy a sheet to another sheet            |

### How to fetch DB

Example code:

```js
// db.fetch()
// Fetch single table
// save_sta = 'Y' is set by default
const upsInfoForm = {
  select: 'no, out_mny',
  sta: 'eq.Y'
};
let upsInfo = await db.fetch('erp_contract_info', upsInfoForm);

// db.multiFetch()
// Fetch multiple tables simultaneously
// save_sta = 'Y' is set by default
const erpContractInfoForm = {
  select: 'no, total_loan_mny'
};
const erpInvInfoForm = {
  select: 'ups_info_no, trade_money'
};
// param for db.multiFetch()
// key => table name
// value => form object
const param = {
  erp_contract_info: erpContractInfoForm,
  erp_inv_info: erpInvInfoForm
};
let [erpContractInfo, erpInvInfo] = await db.multiFetch(param);

// db.fetchRaw()
// Fetch single table
// save_sta = 'Y' is NOT set
const cusPlatInfo = {
  select: 'name, zip'
};
let cusPlatInfo = await db.fetchRaw('cus_plat_info', form);
```

### How to write to sheet in Apps Script

Example Code:

```js
function loadData() {
  var data = '20190102';

  var param = {
    sheetName: 'Sheet1',
    projectName: '17/monthly_return_summary',
    data: data,
    startRow: 6,
    startColumn: 'A'
  };
  writeData(param);
}

function writeData(param) {
  var sheetName = param.sheetName;
  var projectName = param.projectName;
  var data = param.data;
  var startRow = param.startRow;
  var startColumn = param.startColumn;

  // 1. Get data from DB
  var json = {
    token: 'qnS6rcndpS14-coHmwBhuSJ6OzlZ3AhZGbr0VS8VnNo=',
    projectName: projectName,
    data: data
  };
  var result = post2server(json);
  result = JSON.parse(result);

  if (!result || result.length === 0) {
    Logger.log('No result data');
    return;
  }

  if (result.error) {
    throw new Error(result.error);
  }

  // 2. Write to sheet
  var width = result[0].length; // column length
  var height = result.length; // row length
  var range = getRange(startColumn + startRow, width, height);

  var request = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: sheetName + '!' + range,
        majorDimension: 'ROWS',
        values: result
      }
    ]
  };

  var spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var response = Sheets.Spreadsheets.Values.batchUpdate(request, spreadsheetId);
  // Logger.log(response);

  return result;
}

function getRange(startLocation, width, height) {
  var originLetter = startLocation.match(/[a-zA-Z]/)[0]; // single digit only
  var originNumber = startLocation.match(/\d+/)[0];
  originNumber = parseInt(originNumber);

  var destNumber = height + originNumber - 1;
  var asciiDecimal = originLetter.charCodeAt() + width - 1;
  var letterA = '';
  if (asciiDecimal > 90) {
    // if asciiDecimal exceeds the range A ~ Z
    asciiDecimal -= 26;
    letterA = 'A';
  }
  var destLetter = letterA + String.fromCharCode(asciiDecimal);

  return startLocation + ':' + destLetter + destNumber;
}

function post2server(json) {
  var url = 'https://report.example.com';

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(json)
  };

  var response = UrlFetchApp.fetch(url, options);
  return response.getContentText();
}
```

### How to read data from the sheet in Apps Script

```js
function loadData() {
  var param = {
    sheetName: 'Sheet1',
    startColumn: 'A',
    startRow: 6,
    endColumn: 'D',
    endRow: 8
  };
  var data = readRange(param); // read from the range 'Sheet1!A6D8'
}

function readRange(param) {
  var sheetName = param.sheetName;
  var startColumn = param.startColumn;
  var startRow = param.startRow;
  var endColumn = param.endColumn;
  var endRow = param.endRow;

  var spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var range = sheetName + '!' + startColumn + startRow + ':' + endColumn + endRow;

  var response = Sheets.Spreadsheets.Values.get(spreadsheetId, range);
  var arr = response.values;
  return arr;
}

function readCell() {
  var sheetName = 'Sheet1';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var evalDate = sheet
    .getRange('A2:A2')
    .getCell(1, 1)
    .getValue();
  evalDate = Utilities.formatDate(new Date(evalDate), 'GMT+9', 'yyyyMMdd');
  return evalDate;
}
```

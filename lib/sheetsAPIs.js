const { google } = require('googleapis');
const fs = require('fs');
var path = require('path');

function authorize(krossId) {
  // Load client secrets from a local file.
  let credentialsPath = path.join(rootDir, 'auth', krossId, 'credentials.json');
  let credentialsString = fs.readFileSync(credentialsPath, 'utf8');
  let credentials = JSON.parse(credentialsString);
  let { client_id, client_secret, redirect_uris } = credentials.installed;

  let tokenPath = path.join(rootDir, 'auth', krossId, 'token.json');
  let tokenString = fs.readFileSync(tokenPath, 'utf8');
  let token = JSON.parse(tokenString);

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

function batchUpdate(requestData) {

  const oAuth2Client = authorize(krossId);
  if (oAuth2Client == null) {
    console.log('authentication failed');
    return;
  }

  var request = {
    spreadsheetId: spreadsheetId,

    resource: {
      // How the input data should be interpreted.
      valueInputOption: 'USER_ENTERED',

      // The new values to apply to the spreadsheet.
      data: requestData

      // TODO: Add desired properties to the request body.
    },

    auth: oAuth2Client
  };

  let result = false;
  let sheets = google.sheets('v4');
  sheets.spreadsheets.values.batchUpdate(request, function (err, response) {
    if (err) {
      console.error(err);
      return;
    }

    // TODO: Change code below to process the `response` object:
    console.log(response.data);
    result = response.data;
  });

  require('deasync').loopWhile(function () { return !result; });  // block till the code above finishes

  return result;
}

function update(range, arrayData) {

  const oAuth2Client = authorize(krossId);
  if (oAuth2Client == null) {
    console.log('authentication failed');
    return;
  }

  var request = {
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: 'USER_ENTERED',

    resource: {
      // range: range,
      majorDimension: 'ROWS',
      values: arrayData

    },

    auth: oAuth2Client
  };

  let result = false;
  let sheets = google.sheets('v4');
  sheets.spreadsheets.values.update(request, function (err, response) {
    if (err) {
      console.error(err);
      return;
    }

    // TODO: Change code below to process the `response` object:
    console.log(response.data);
    result = response.data;
  });

  require('deasync').loopWhile(function () { return !result; });  // block till the code above finishes

  return result;
}

function read(range) {

  const oAuth2Client = authorize(krossId);
  if (oAuth2Client == null) {
    console.log('authentication failed');
    return;
  }

  var request = {
    spreadsheetId: spreadsheetId,
    range: range,
    // valueRenderOption: 'FORMATTED_VALUE',  // default
    // dateTimeRenderOption: 'SERIAL_NUMBER',  // ignored if FORMATTED_VALUE
    auth: oAuth2Client
  };

  let result = false;
  let sheets = google.sheets('v4');
  sheets.spreadsheets.values.get(request, function (err, response) {
    if (err) {
      console.error(err);
      return;
    }

    // TODO: Change code below to process the `response` object:
    console.log(response.data);
    result = response.data;
  });

  require('deasync').loopWhile(function () { return !result; });  // block till the code above finishes

  return result;
}

function clear(range) {

  const oAuth2Client = authorize(krossId);
  if (oAuth2Client == null) {
    console.log('authentication failed');
    return;
  }

  var request = {
    spreadsheetId: spreadsheetId,
    range: range,
    resource: {},
    auth: oAuth2Client,
  };

  let result = false;
  let sheets = google.sheets('v4');
  sheets.spreadsheets.values.clear(request, function (err, response) {
    if (err) {
      console.error(err);
      return;
    }

    // TODO: Change code below to process the `response` object:
    console.log(response.data);
    result = response.data;
  });

  require('deasync').loopWhile(function () { return !result; });  // block till the code above finishes

  return result;
}

function copySheet(gid) {
  const oAuth2Client = authorize(krossId);
  if (oAuth2Client == null) {
    console.log('authentication failed');
    return;
  }

  var request = {
    spreadsheetId: spreadsheetId,

    // The ID of the sheet to copy.
    sheetId: gid,

    resource: {
      // The ID of the spreadsheet to copy the sheet to.
      destinationSpreadsheetId: spreadsheetId
    },

    auth: oAuth2Client
  };

  let result = false;
  let sheets = google.sheets('v4');
  sheets.spreadsheets.sheets.copyTo(request, function (err, response) {
    if (err) {
      console.error(err);
      return;
    }

    // TODO: Change code below to process the `response` object:
    console.log(response.data);
    result = response.data;
  });

  require('deasync').loopWhile(function () { return !result; });  // block till the code above finishes

  return result;
}

function sheetConfig(krossId, spreadsheetId) {
  global.spreadsheetId = spreadsheetId;
  global.krossId = krossId;
}

module.exports = {
  authorize,
  sheetConfig,
  read,
  clear,
  update,
  batchUpdate,
  copySheet
}

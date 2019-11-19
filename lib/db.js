const { get } = require('./common.js');
const url = require('url');
const config = require('../config/default.json')[process.env.GS_ENV || 'development'];
// const config = require('../config/local2dev.json')[process.env.GS_ENV || 'development'];
// const config = require('../config/local2dev2.json')[process.env.GS_ENV || 'development'];
// const config = require('../config/local2dev3.json')[process.env.GS_ENV || 'development'];
// const config = require('../config/local4bin.json')[process.env.GS_ENV || 'development'];

module.exports = {
  fetch: async function(tableName, form) {
    // build form for GET request
    let db_url = url.resolve(config['db_url'], tableName);
    form['save_sta'] = 'eq.Y';
    form['offset'] = 0;
    // form['limit'] = 1000;  // set by default

    // query DB
    let result = [];
    do {
      var singlePage = await get(db_url, form);
      result.push(...singlePage); // extend array
      form['offset'] += 1000;
    } while (singlePage.length === 1000);

    return result;
  },

  fetchRaw: async function(tableName, form) {
    // build form for GET request
    let db_url = url.resolve(config['db_url'], tableName);
    form['offset'] = 0;
    // form['limit'] = 1000;  // set by default

    // query DB
    let result = [];
    do {
      var singlePage = await get(db_url, form);
      result.push(...singlePage); // extend array
      form['offset'] += 1000;
    } while (singlePage.length === 1000);

    return result;
  },

  multiFetch: async function(param) {
    let promises = [];
    for (const tableName of Object.keys(param)) {
      const form = param[tableName];
      promises.push(module.exports.fetch(tableName, form));
    }
    let delivered = await Promise.all(promises);
    return delivered;
  },

  multiFetchRaw: async function(param) {
    let promises = [];
    for (const tableName of Object.keys(param)) {
      const form = param[tableName];
      promises.push(module.exports.fetchRaw(tableName, form));
    }
    let delivered = await Promise.all(promises);
    return delivered;
  },

  fetchProd: async function(tableName, form) {
    // build form for GET request
    let db_url = `http://10.28.7.197:7999/svc/pgt/${tableName}`;
    form['save_sta'] = 'eq.Y';
    form['offset'] = 0;
    // form['limit'] = 1000;  // set by default

    // query DB
    let result = [];
    do {
      var singlePage = await get(db_url, form);
      result.push(...singlePage); // extend array
      form['offset'] += 1000;
    } while (singlePage.length === 1000);

    return result;
  },

  fetchRawProd: async function(tableName, form) {
    // build form for GET request
    let db_url = `http://10.28.7.197:7999/svc/pgt/${tableName}`;
    // form['save_sta'] = 'eq.Y';
    form['offset'] = 0;
    // form['limit'] = 1000;  // set by default

    // query DB
    let result = [];
    do {
      var singlePage = await get(db_url, form);
      result.push(...singlePage); // extend array
      form['offset'] += 1000;
    } while (singlePage.length === 1000);

    return result;
  },

  fetchDev: async function(tableName, form) {
    // build form for GET request
    let db_url = `http://restd.example.com/${tableName}`;
    // form['save_sta'] = 'eq.Y';
    form['offset'] = 0;
    // form['limit'] = 1000;  // set by default

    // query DB
    let result = [];
    do {
      var singlePage = await get(db_url, form);
      result.push(...singlePage); // extend array
      form['offset'] += 1000;
    } while (singlePage.length === 1000);

    return result;
  },

  fetchCore: async function(tableName, form) {
    // build form for GET request
    let core_url = url.resolve(config['core_url'], tableName);
    form['offset'] = 0;
    // form['limit'] = 1000;  // set by default

    // query DB
    let result = [];
    do {
      var singlePage = await get(core_url, form);
      result.push(...singlePage); // extend array
      form['offset'] += 1000;
    } while (singlePage.length === 1000);

    return result;
  },

  // Left Outer Join
  // Only one right column gets added, however.
  leftOuterJoin: function(param) {
    let leftTable = param.leftTable;
    let sharedColumnLeft = param.sharedColumnLeft;
    let rightTable = param.rightTable;
    let sharedColumnRight = param.sharedColumnRight;
    let targetColumns = param.targetColumns; // array

    for (const i of leftTable.keys()) {
      for (const rightRow of rightTable) {
        if (leftTable[i][sharedColumnLeft] === rightRow[sharedColumnRight]) {
          // leftTable[i][newColumnName] = rightRow[rightColumn];
          for (const columnString of targetColumns) {
            leftTable[i]['$' + columnString] = rightRow[columnString];
          }
        }
      }
    }
    return leftTable;
  },

  getPaymentHistory: async function() {
    // query table: erp_in_mny
    var form = {
      select: 'contract_info_no, trade_mny'
    };
    let erpInMny = await module.exports.fetch('erp_in_mny', form);

    let paymentHistory = {};
    for (const record of erpInMny) {
      let contractInfoNo = record.contract_info_no;
      if (typeof paymentHistory[contractInfoNo] === 'undefined') {
        paymentHistory[contractInfoNo] = record.trade_mny;
      } else {
        paymentHistory[contractInfoNo] += record.trade_mny;
      }
    }

    return paymentHistory;
  },

  getSalesHistory: async function() {
    // query table: ups_info
    var form = {
      select: 'no, out_mny',
      sta: 'eq.Y'
    };
    let upsInfo = await module.exports.fetch('ups_info', form);

    let salesHistory = {};
    for (const record of upsInfo) {
      salesHistory[record.no] = record.out_mny;
    }

    return salesHistory;
  },

  getBalanceHistory: async function() {
    // query table: ups_info
    var form = {
      select: 'no',
      sta: 'eq.Y'
    };
    let upsInfo = await module.exports.fetch('ups_info', form);

    // query table: erp_contract_info
    var form = {
      select: 'ups_info_no, tail_mny'
    };
    let erpContractInfo = await module.exports.fetch('erp_contract_info', form);

    // join table: ups_info + erp_contract_info
    var joinParam = {
      leftTable: upsInfo,
      sharedColumnLeft: 'no',
      rightTable: erpContractInfo,
      sharedColumnRight: 'ups_info_no',
      targetColumns: ['tail_mny']
    };
    let upsErpJoined = module.exports.leftOuterJoin(joinParam);

    let balanceHistory = {};
    for (const i of upsErpJoined.keys()) {
      let upsNo = upsErpJoined[i]['no'];
      let tailMny = upsErpJoined[i]['$tail_mny']; // 대출금액 - 상환 원금 = 대출잔액
      if (tailMny > 0) {
        balanceHistory[upsNo] = tailMny;
      }
    }

    return balanceHistory;
  },

  validateMember: async function(memberNo) {
    // query table: cus_plat_info
    var form = {
      select: 'member_no',
      member_no: 'eq.' + memberNo
    };
    let cusPlatInfo = await module.exports.fetchRaw('cus_plat_info', form);

    // query table: cus_member
    var form = {
      select: 'no',
      no: 'eq.' + memberNo
    };
    let cusMember = await module.exports.fetch('cus_member', form);

    // validity check
    // if member has completed the full authentication process
    // or if member_no exists
    // or if member_no is no longer valid
    return cusPlatInfo.length > 0 && cusMember.length > 0;
  }
};

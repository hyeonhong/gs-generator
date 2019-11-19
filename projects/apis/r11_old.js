
// load common module
const { get, post, sleep, getToday, getDate } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');

const moment = require('moment');

async function main(upsNos) {
  // if (!upsNos || !Array.isArray(upsNos)) {
  //   return {
  //     error: {
  //       code: 400,
  //       message: 'The parameter ups_info_no is missing or not an array.'
  //     }
  //   };
  // }

  // upsNos = [3562, 1631];

  // query table: ups_info
  var form = {
    select: 'no, out_mny, app_mny, out_dt, inv_ratio, due_dt, due_inv_dt',
    sta: 'eq.Y',
  };
  let upsInfo = await db.fetch('ups_info', form);
  upsInfo = upsInfo.filter(function (arr) {
    if (upsNos.includes(arr.no)) {
      return arr;
    }
  });
  if (!upsInfo.length) {  // result is empty
    return [];
  }

  // query table: erp_contract_info
  var form = {
    select: 'ups_info_no, no, cont_term, disc_mny, cont_dt, ups_no, b_upcd, tail_mny, sta'
  };
  let erpContractInfo = await db.fetch('erp_contract_info', form);

  for (const i of upsInfo.keys()) {
    innerLoop:
    for (const rightRow of erpContractInfo) {
      if (upsInfo[i]['no'] === rightRow['ups_info_no']) {
        upsInfo[i]['erpNo'] = rightRow['no'];
        upsInfo[i]['loanPeriod'] = parseInt(rightRow['cont_term']);
        upsInfo[i]['discMny'] = rightRow['disc_mny'];
        upsInfo[i]['contDt'] = rightRow['cont_dt'];
        upsInfo[i]['productNo'] = rightRow['ups_no'];
        // upsInfo[i]['tailMny'] = rightRow['tail_mny'];
        upsInfo[i]['status'] = rightRow['sta'];
        upsInfo[i]['bizType'] = getBizType(rightRow['b_upcd']);
        break innerLoop;
      }
    }
  }

  // query table: erp_trade_book
  var form = {
    select: 'contract_info_no, trade_mny',
    trade_type: 'eq.' + 'I',  // 입금
  };
  let erpTradeBook = await db.fetch('erp_trade_book', form);

  for (const i of upsInfo.keys()) {
    upsInfo[i]['returnedAmt'] = 0;  // initialize

    for (const rightRow of erpTradeBook) {
      if (upsInfo[i]['erpNo'] === rightRow['contract_info_no']) {
        upsInfo[i]['returnedAmt'] += rightRow['trade_mny'];
      }
    }
  }

  // query table: erp_out_mny
  var form = {
    select: 'contract_info_no, save_tm'
  };
  let erpOutMny = await db.fetch('erp_out_mny', form);
  let erpNo2OutTm = {};
  erpOutMny.map(function (arr) {
    let erpNo = arr.contract_info_no;
    erpNo2OutTm[erpNo] = arr.save_tm;
  });

  // query table: erp_inv_info
  var form = {
    select: 'contract_info_no, no',
  };
  let erpInvInfo = await db.fetch('erp_inv_info', form);
  let erpInvNo2ErpNo = {};
  let erpNo2TotalInvestors = {};
  for (const record of erpInvInfo) {
    let erpNo = record.contract_info_no;
    let erpInvNo = record.no;
    erpInvNo2ErpNo[erpInvNo] = erpNo;

    erpNo2TotalInvestors[erpNo] = erpNo2TotalInvestors[erpNo] || 0;
    erpNo2TotalInvestors[erpNo]++;
  }

  // query table: inv_income_return
  var form = {
    select: 'erp_inv_info_no, return_origin, return_interest, p_fee, income_tax, local_tax, trade_dt, trade_tm',
  };
  let invIncomeReturn = await db.fetch('inv_income_return', form);

  for (const i of upsInfo.keys()) {
    upsInfo[i]['returnOrigin'] = 0;  // initialize the value to 0
    upsInfo[i]['returnInterest'] = 0;
    upsInfo[i]['pFee'] = 0;
    upsInfo[i]['tax'] = 0;
    upsInfo[i]['returnCount'] = 0;
    upsInfo[i]['returned'] = false;

    for (const rightRow of invIncomeReturn) {
      let erpInvNo = rightRow['erp_inv_info_no'];
      let erpNo = erpInvNo2ErpNo[erpInvNo];
      if (upsInfo[i]['erpNo'] === erpNo) {
        upsInfo[i]['returnDt'] = rightRow['trade_dt'];  // keep getting updated
        upsInfo[i]['returnTm'] = rightRow['trade_tm'];

        upsInfo[i]['returnOrigin'] += rightRow['return_origin'];
        upsInfo[i]['returnInterest'] += rightRow['return_interest'];
        upsInfo[i]['pFee'] += rightRow['p_fee'];
        upsInfo[i]['tax'] += rightRow['income_tax'] + rightRow['local_tax'];
        upsInfo[i]['returnCount']++;
        upsInfo[i]['returned'] = true;  // 분배 여부
      }
    }
  }

  // analyze

  for (const i of upsInfo.keys()) {
    let record = upsInfo[i];

    if (record['returned']) {  // 분배있을 경우
      let returnCount = record['returnCount'];
      let erpNo = record['erpNo'];
      let totalInvestors = erpNo2TotalInvestors[erpNo];
      returnCount /= totalInvestors;
      returnCount = Math.trunc(returnCount);
      record['returnCount'] = returnCount;  // 상환회차
      let realInvRatio = record['returnInterest'] / record['returnOrigin'] * (365 / record['loanPeriod']) * 100;
      record['realInvRatio'] = parseFloat(realInvRatio.toFixed(3));
    }
  }

  // build items
  let items = [];
  // let header = ['월별', '건수', '총 대출금액'];
  for (const record of upsInfo) {
    let returnCompleteAmt = 0;
    let returnDt;
    if (record.returned) {
      returnCompleteAmt = record.returnOrigin + record.returnInterest + record.tax;
      returnDt = moment(record.returnDt + 'T' + record.returnTm).format();
    }

    let item = {
      product_no: record.productNo,  // 상품번호
      repay_count: record.returnCount || 0,  // 상환회차
      max_repay_count: 1,  // 전체상환회차
      name: `${record.bizType} ${record.productNo}호`,  // 상품명
      date: moment(record.out_dt + 'T' + erpNo2OutTm[record.erpNo]).format(),  // 투자시작일 (대출지급일, timestamp)
      published_rate: record.inv_ratio,  // 상품수익률 (게시 수익률)
      profit_rate: record.realInvRatio || null, // 세후수익률 (실수익률)
      days: record.loanPeriod,  // 투자일수
      issue_date: moment(record.due_dt).format(),  // 만기일 (timestamp)
      return_date: moment(record.due_inv_dt).format(),  // 상환예정일 (timestamp)
      repay_done_date: returnDt || null,  // 상환완료일 (timestamp)
      status: getRealStatus(record.status, record.due_dt),  // 상품상태
      invested: record.out_mny, // 투자금액 (모집금액, 대출지급액과 동일)
      repaid: returnCompleteAmt, // 상환완료금액
      expected: record.app_mny - record.returnedAmt,  // 상환예정금액
      fee: record.pFee || null,  // 수수료 금액 (상환완료건)
      tax: record.tax || null,  // 세금 (상환완료건)
      net_profit: record.returnInterest || null, // 실수익(세후이자)
    }
    items.push(item);
  }

  // let result = { items: items };

  return items;
}


function getRealStatus(status, dueDt) {
  let realStatus;
  if (status === 'A') {
    realStatus = 'investing';
  } else if (status === 'E') {
    realStatus = 'done';
  } else if (status === 'B') {
    // 연체일 계산
    let todayObj = new Date(getToday('-'));  // UTC
    let dueDtObj = new Date(addDashDate(dueDt));
    let lateDays = (todayObj - dueDtObj) / (1000 * 60 * 60 * 24);
    if (lateDays < 30) {
      realStatus = 'delayed';
    } else if (lateDays < 60) {
      realStatus = 'delayed30';
    } else if (lateDays < 90) {
      realStatus = 'delayed60';
    } else {
      realStatus = 'delayed90';
    }
  }
  return realStatus;
}

function getBizType(upcd) {
  const upcd2BizType = {
    "UP1": "경공업",
    "UP2": "중공업",
    "UP3": "건설업",
    "UP4": "도소매업",
    "UP5": "기타서비스업"
  };
  return upcd2BizType[upcd];
}


module.exports = {
  main
}

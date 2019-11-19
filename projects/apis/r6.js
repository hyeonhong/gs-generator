
// load common module
const { get, post, sleep, getToday, getDate } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');

const moment = require('moment');

async function main(memberNo) {
  // memberNo = 57;
  // memberNo = 3895;  // 3895, 4063, 4141, 4197, 4266

  let isValidMember = await db.validateMember(memberNo);
  if (!isValidMember) {
    return {
      error: {
        code: 404,
        message: 'The member_no does not exist, or the member has not completed the authentication process.'
      }
    };
  }

  // query table: ups_inv_info
  var form = {
    select: 'no, ups_info_no, member_no, ratio, trade_money, save_dt, save_tm',
    member_no: 'eq.' + memberNo,
  };
  let upsInvInfo = await db.fetch('ups_inv_info', form);
  let upsNo2UpsInvInfoRow = {};
  upsInvInfo.map(function (arr) {
    let upsNo = arr.ups_info_no;
    upsNo2UpsInvInfoRow[upsNo] = arr;  // only single member exists per upsNo
  });

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

  // query table: ups_info
  var form = {
    select: 'no, due_inv_dt',
    sta: 'eq.' + 'Y',
  };
  let upsInfo = await db.fetch('ups_info', form);
  let upsNo2Row = {};
  upsInfo.map(function (arr) {
    let upsNo = arr.no;
    upsNo2Row[upsNo] = arr;
  });

  // query table: erp_contract_info
  var form = {
    select: 'no, ups_info_no, sta, cont_term, out_dt, return_dt, ups_no, b_upcd'
  };
  let erpContractInfo = await db.fetch('erp_contract_info', form);
  let erpNo2Row = {};
  let erpNo2UpsNo = {};
  erpContractInfo.map(function (arr) {
    let erpNo = arr.no;
    erpNo2Row[erpNo] = arr;
    erpNo2UpsNo[erpNo] = arr.ups_info_no;
  });


  // query table: erp_inv_info
  var form = {
    select: 'no, contract_info_no',
    member_no: 'eq.' + memberNo,
  };
  let erpInvInfo = await db.fetch('erp_inv_info', form);
  let erpInvInfoNo2ErpNo = {};
  erpInvInfo.forEach(function (arr) {
    let erpNo = arr.contract_info_no;
    let erpInvInfoNo = arr.no;
    erpInvInfoNo2ErpNo[erpInvInfoNo] = erpNo;
  });

  // query table: inv_income_return
  var form = {
    select: 'erp_inv_info_no, return_origin, return_interest, local_tax, income_tax, p_fee, trade_dt, trade_tm',
    member_no: 'eq.' + memberNo,
    sta: 'eq.' + 'C'
  };
  let invIncomeReturn = await db.fetch('inv_income_return', form);

  let items = [];
  let erpInvInfo2ReturnCount = {};
  invIncomeReturn.forEach(function (arr) {
    let erpInvInfoNo = arr.erp_inv_info_no;
    let erpNo = erpInvInfoNo2ErpNo[erpInvInfoNo];
    let status = erpNo2Row[erpNo]['sta'];
    if (status !== 'E') {  // 부분 상환
      return;  // move to next iteration
    }

    erpInvInfo2ReturnCount[erpInvInfoNo] = erpInvInfo2ReturnCount[erpInvInfoNo] || 0;
    erpInvInfo2ReturnCount[erpInvInfoNo]++;

    let upsNo = erpNo2UpsNo[erpNo];
    let upsInvInfoRow = upsNo2UpsInvInfoRow[upsNo];
    let saveDt = upsInvInfoRow['save_dt'];
    let saveTm = upsInvInfoRow['save_tm'];
    let upsRow = upsNo2Row[upsNo];

    let returnDt = arr.trade_dt;
    let returnTm = arr.trade_tm;
    let returnOrigin = arr.return_origin;
    let returnInterest = arr.return_interest;
    let returnInterestBeforeTax = arr.return_interest + arr.income_tax + arr.local_tax;
    let loanPeriod = parseInt(erpNo2Row[erpNo]['cont_term']);
    let dueDt = erpNo2Row[erpNo]['return_dt'];
    let outDt = erpNo2Row[erpNo]['out_dt'];
    let outTm = erpNo2OutTm[erpNo];

    let invRatio = returnInterest / returnOrigin * (365 / loanPeriod) * 100;
    // let invRatioBeforeTax = returnInterestBeforeTax / returnOrigin * (365 / loanPeriod) * 100;

    let item = {
      invested_no: upsInvInfoRow['no'],  // 투자번호
      product_no: erpNo2Row[erpNo]['ups_no'],  // 상품번호
      repay_count: erpInvInfo2ReturnCount[erpInvInfoNo],  // 상환회차
      max_repay_count: 1,  // 전체상환회차  
      name: `${getBizType(erpNo2Row[erpNo]['b_upcd'])} ${erpNo2Row[erpNo]['ups_no']}호`,  // 상품명
      invested_at: moment(saveDt + 'T' + saveTm).format(),  // 투자입력일 (timestamp)
      date: moment(outDt + 'T' + outTm).format(),  // 투자시작일 (대출지급일, timestamp)
      published_rate: upsInvInfoRow['ratio'],  // 상품수익률 (게시 수익률)
      profit_rate: parseFloat(invRatio.toFixed(3)),  // 세후수익률 (실수익률)
      days: loanPeriod,  // 투자일수
      issue_date: moment(dueDt).format(),  // 만기일 (timestamp)
      return_date: moment(upsRow['due_inv_dt']).format(),  // 상환예정일 (timestamp)
      repay_done_date: moment(returnDt + 'T' + returnTm).format(),  // 상환완료일 (timestamp)
      status: 'done',
      invested: returnOrigin,  // 투자금액
      repaid: returnOrigin + returnInterestBeforeTax,  // 상환완료금액
      expected: null,  // 상환예정금액
      fee: arr.p_fee,  // 수수료 금액
      tax: arr.income_tax + arr.local_tax,  // 세금
      net_profit: returnInterestBeforeTax - arr.income_tax - arr.local_tax,  // 세후 이자
    };

    items.push(item);
  });

  // console.log(items);
  return items;
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

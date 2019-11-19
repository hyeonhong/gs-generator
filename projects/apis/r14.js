
// load common module
const { get, post, sleep, getToday, getDate, getWeightedAvg, addDashDate } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');

const moment = require('moment');

async function main({ productNo, memberNo }) {
  // async function main(data) {
  // productNo = 426;  // 426, 1454
  // memberNo = 57;

  // query table: erp_contract_info
  var form = {
    select: 'no, sta, b_upcd, ups_info_no, return_dt',
    ups_no: 'eq.' + productNo,
  };
  let erpContractInfo = await db.fetch('erp_contract_info', form);
  if (!erpContractInfo.length) {  // empty result
    return {};
  }
  let erpNo = erpContractInfo[0].no;
  let upsNo = erpContractInfo[0].ups_info_no;
  let status = erpContractInfo[0].sta;
  let dueDt = erpContractInfo[0].return_dt;
  let bizType = getBizType(erpContractInfo[0].b_upcd);
  let productName = `${bizType} ${productNo}호`;

  // query table: erp_ci_log_sta
  var form = {
    select: 'save_dt, save_tm',
    sta: 'eq.' + 'B',  // 한번이라도 B 로 바뀌었는지 확인
    contract_info_no: 'eq.' + erpNo,
    order: 'save_dt.asc, save_tm.asc',  // most oldest
  };
  let erpCiLogSta = await db.fetch('erp_ci_log_sta', form);
  let lateStartDate = null;
  if (erpCiLogSta.length > 0) {
    let lateTm = erpCiLogSta[0].save_tm;
    let lateDt = erpCiLogSta[0].save_dt;
    let lateDtObj = new Date(addDashDate(lateDt));
    lateDtObj.setDate(lateDtObj.getDate() - 1);  // subtract 1 day
    lateDt = getDate(lateDtObj);

    lateStartDate = moment(lateDt + 'T' + lateTm).format();
  }

  // query table: erp_inv_info
  var form = {
    select: 'no, p_fee_rate, trade_money',
    contract_info_no: 'eq.' + erpNo,
    member_no: 'eq.' + memberNo
  };
  let erpInvInfo = await db.fetch('erp_inv_info', form);
  if (!erpInvInfo.length) {
    return {};
  }
  let erpInvInfoNo = erpInvInfo[0].no;

  // query table: ups_inv_info
  var form = {
    select: 'no',
    member_no: 'eq.' + memberNo,
    ups_info_no: 'eq.' + upsNo
  };
  let upsInvInfo = await db.fetch('ups_inv_info', form);
  let upsInvInfoNo = upsInvInfo[0].no;

  // query table: inv_income_return
  var form = {
    select: 'return_origin, return_interest, local_tax, income_tax, p_fee, trade_dt, trade_tm',
    erp_inv_info_no: 'eq.' + erpInvInfoNo,
    sta: 'eq.' + 'C',
    order: 'trade_dt.asc, trade_tm.asc',  // most oldest first
  };
  let invIncomeReturn = await db.fetch('inv_income_return', form);

  let items = [];
  let returnCount = 0;
  invIncomeReturn.forEach(function (arr) {
    // 상환 회차
    returnCount++;

    let returnDt = arr.trade_dt;
    let returnTm = arr.trade_tm;
    let returnOrigin = arr.return_origin;
    let returnInterest = arr.return_interest;
    let tax = arr.local_tax + arr.income_tax;
    let fee = arr.p_fee;

    let item = {
      date: moment(returnDt + 'T' + returnTm).format(),  // 상환일 (timestamp)
      fund_amount: returnOrigin,  // 모집금액 (원금)
      repaid: returnOrigin + returnInterest + tax,  // 상환금액
      net_profit: returnInterest,  // 세후 이자
      fee: fee,  // 수수료 금액
      tax: tax,  // 세금
    }
    items.push(item);
  });

  // build result
  let result = {
    invested_no: upsInvInfoNo,  // 투자번호
    product_no: productNo,  // 상품번호
    repay_count: returnCount,  // 상환회차
    max_repay_count: 1,  // 전체상환회차
    name: productName,  // 상품명
    status: getRealStatus(status, dueDt),  // 상품상태
    delayFrom: lateStartDate,  // 연체시작일
    returns: items
  };

  // console.log(result);
  return result;
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

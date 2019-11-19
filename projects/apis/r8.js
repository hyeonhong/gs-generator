// load common module
const { get, post, sleep, getToday, getDate, getWeightedAvg } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');

const moment = require('moment');

async function main({ memberNo, productNo }) {
  // async function main(data) {
  // memberNo = 57;
  // productNo = 1454;

  let isValidMember = await db.validateMember(memberNo);
  if (!isValidMember) {
    return {
      error: {
        code: 404,
        message:
          'The member_no does not exist, or the member has not completed the authentication process.'
      }
    };
  }

  // query table: erp_contract_info
  var form = {
    select:
      'no, ups_info_no, sta, cont_term, cont_attr1, total_loan_mny, out_dt, disc_mny, return_dt, b_upcd',
    ups_no: 'eq.' + productNo
  };
  let erpContractInfo = await db.fetch('erp_contract_info', form);
  // validity check for product_no
  if (!erpContractInfo.length) {
    // empty result
    let result = {
      error: {
        code: 404,
        message: 'product_no not found'
      }
    };
    return result;
  }
  let erpNo = erpContractInfo[0].no;
  let upsNo = erpContractInfo[0].ups_info_no;
  let status = erpContractInfo[0].sta;
  let loanPeriod = parseInt(erpContractInfo[0].cont_term);
  let bankruptcyFlag = erpContractInfo[0].cont_attr1;
  let dueDt = erpContractInfo[0].return_dt;
  let outDt = erpContractInfo[0].out_dt;
  let outMny = erpContractInfo[0].total_loan_mny;
  let discMny = erpContractInfo[0].disc_mny;
  let bizType = getBizType(erpContractInfo[0].b_upcd);

  // query table: ups_info
  var form = {
    select: 'due_inv_dt',
    no: 'eq.' + upsNo
  };
  let upsInfo = await db.fetch('ups_info', form);
  let dueInvDt = upsInfo[0].due_inv_dt;

  // query table: ups_inv_info
  var form = {
    select: 'no, ups_info_no, member_no, ratio, trade_money, save_dt, save_tm',
    member_no: 'eq.' + memberNo,
    ups_info_no: 'eq.' + upsNo
  };
  let upsInvInfo = await db.fetch('ups_inv_info', form);
  // validity check for matching ups_info_no
  if (!upsInvInfo.length) {
    // empty result
    let result = {
      error: {
        code: 404,
        message: 'matching products not found'
      }
    };
    return result;
  }
  let upsInvInfoNo = upsInvInfo[0].no;
  let invRatio = upsInvInfo[0].ratio;
  let saveDt = upsInvInfo[0].save_dt;
  let saveTm = upsInvInfo[0].save_tm;
  let investmentAmt = upsInvInfo[0].trade_money;

  // query table: erp_out_mny
  var form = {
    select: 'save_tm',
    contract_info_no: 'eq.' + erpNo
  };
  let erpOutMny = await db.fetch('erp_out_mny', form);
  let outTm = erpOutMny[0].save_tm;

  // query table: erp_inv_info
  var form = {
    select: 'no, contract_info_no, p_fee_rate',
    member_no: 'eq.' + memberNo,
    contract_info_no: 'eq.' + erpNo
  };
  let erpInvInfo = await db.fetch('erp_inv_info', form);
  let erpInvInfoNo = erpInvInfo[0].no;
  let feeRate = erpInvInfo[0].p_fee_rate;

  let pageUrl; // 투자상품 URL
  let paperUrl; // 원리금수취권증서 URL
  let productionServers = ['production', 'as1', 'as2', 'as3'];
  if (productionServers.includes(process.env.GS_ENV)) {
    pageUrl = `https://90days.kr/finnq/invDetail?no=${upsNo}`;
    paperUrl = `https://90days.kr/finnq/incomeReceipt?no=${productNo}&memberNo=${memberNo}`;
  } else {
    pageUrl = `https://dev-finnq.example.com/finnq/invDetail?no=${upsNo}`;
    paperUrl = `https://dev-finnq.example.com/finnq/incomeReceipt?no=${productNo}&memberNo=${memberNo}`;
  }

  let item = {
    invested_no: upsInvInfoNo, // 투자번호
    product_no: productNo, // 상품번호
    repay_count: null, // 상환회차
    max_repay_count: 1, // 전체상환회차
    name: `${bizType} ${productNo}호`, // 상품명
    invested_at: moment(saveDt + 'T' + saveTm).format(), // 투자입력일 (timestamp)
    date: moment(outDt + 'T' + outTm).format(), // 투자시작일 (대출지급일, timestamp)
    published_rate: invRatio, // 상품수익률 (게시 수익률)
    profit_rate: null, // 세후수익률 (실수익률)
    days: loanPeriod, // 투자일수
    issue_date: moment(dueDt).format(), // 만기일 (timestamp)
    return_date: moment(dueInvDt).format(), // 상환예정일 (timestamp)
    repay_done_date: null, // 상환완료일 (timestamp)
    status: status, // 상품상태
    invested: investmentAmt, // 투자금액
    fund_amount: outMny, // 상품모집금액
    repaid: null, // 상환완료금액
    expected: null, // 상환예정금액
    fee: null, // 수수료 금액
    tax: null, // 세금
    net_profit: null, // 세후 이자
    paper_url: paperUrl, // 원리금수취권증서 URL
    page_url: pageUrl, // 투자상품 URL
    expected_fee: 0,
    expected_tax: 0,
    expected_net_profit: 0
  };

  // query table: inv_income_return
  var form = {
    select:
      'erp_inv_info_no, return_origin, return_interest, local_tax, income_tax, p_fee, trade_dt, trade_tm',
    erp_inv_info_no: 'eq.' + erpInvInfoNo,
    sta: 'eq.' + 'C',
    order: 'trade_dt.asc, trade_tm.asc' // most oldest
  };
  let invIncomeReturn = await db.fetch('inv_income_return', form);

  // 부분상환건
  let returnCount = 0;
  let partialReturnOrigin = 0;
  let partialReturnInterest = 0;
  let wAvgInvRatio = 0; // 세후 수익률
  let totalFee = 0;
  let totalTax = 0;
  let returnDt;
  let returnTm;
  invIncomeReturn.forEach(function(arr) {
    // if (status === 'E') {  // 완전 상환
    //   throw new Error('Use this path for unfinished products only');
    // }

    // 상환 회차
    returnCount++;

    returnDt = arr.trade_dt;
    returnTm = arr.trade_tm;
    let returnOrigin = arr.return_origin;
    let returnInterest = arr.return_interest;

    let realInvRatio = (returnInterest / returnOrigin) * (365 / loanPeriod) * 100;
    wAvgInvRatio = getWeightedAvg(realInvRatio, returnOrigin, partialReturnOrigin, wAvgInvRatio);

    partialReturnOrigin += returnOrigin;
    partialReturnInterest += returnInterest;
    totalTax += arr.income_tax + arr.local_tax;
    totalFee += arr.p_fee;
  });

  if (returnCount) {
    item.repay_count = returnCount; // 상환회차
    item.profit_rate = parseFloat(wAvgInvRatio.toFixed(3)); // 세후수익률 (실수익률)
    item.repaid = partialReturnOrigin + partialReturnInterest + totalTax; // 상환완료금액
    item.fee = totalFee; // 수수료 금액
    item.tax = totalTax; // 세금
    item.net_profit = partialReturnInterest; // 세후이자
    item.repay_done_date = moment(returnDt + 'T' + returnTm).format(); // 상환완료일
  }

  // 미상환건

  investmentAmt -= partialReturnOrigin;

  // get returnInterest
  let param = {
    tradeMoney: investmentAmt,
    outMny: outMny,
    outDate: outDt,
    loanPeriod: loanPeriod,
    discMny: discMny,
    feeRatio: feeRate
  };
  let returnInfo = getReturnInfoNoProCheck(param);
  let returnInterest = returnInfo.returnInterest;
  let fee = returnInfo.fee;
  let tax = returnInfo.tax;
  let realInvRatio = (returnInterest / investmentAmt) * (365 / loanPeriod) * 100;

  item.expected = investmentAmt + returnInterest + tax; // 상환예정금액
  item.expected_fee = fee;
  item.expected_tax = tax;
  item.expected_net_profit = returnInterest;
  item.profit_rate = parseFloat(realInvRatio.toFixed(3)); // 세후수익률 (실수익률)

  item.status = getRealStatus(status, dueDt);

  // console.log(item);
  return item;
}

function getReturnInfoNoProCheck(param) {
  let { tradeMoney, outMny, discMny, feeRatio, outDate, loanPeriod } = param;

  // let tradeMoney = rightRow['trade_money'];
  let ratio = tradeMoney / outMny;
  let divOrigin = Math.trunc(outMny * ratio);
  let divInterest = Math.trunc(discMny * ratio);
  // let feeRatio = rightRow['p_fee_rate'];
  let fee = getFee(feeRatio, outDate, loanPeriod, divOrigin, divInterest);
  let interestBeforeTax = divInterest - fee; // 수수료 차감후, <투자자> 이자 (세전)

  // calculate tax
  let incomeTax = Math.trunc(interestBeforeTax * 0.025) * 10; // 소득세
  let localTax = Math.trunc(incomeTax * 0.01) * 10; // 지방세
  let interestAfterTax = interestBeforeTax - incomeTax - localTax; // 세금 차감후, <투자자> 이자 (세후)
  let returnInfo = {
    returnInterest: interestAfterTax,
    fee: fee,
    tax: incomeTax + localTax
  };
  return returnInfo;
}

function getFee(feeRatio, outDate, loanPeriod, divOrigin, divInterest) {
  outDate = outDate.slice(0, 4) + '-' + outDate.slice(4, 6) + '-' + outDate.slice(6, 8);
  let year = new Date(outDate).getFullYear();
  let isLeapYear = new Date(year, 1, 29).getMonth() === 1;
  if (isLeapYear) {
    feeRatio = feeRatio * (loanPeriod / 366);
  } else {
    feeRatio = feeRatio * (loanPeriod / 365);
  }
  let fee = ((divOrigin + divInterest) * feeRatio) / 100;
  fee = Math.trunc(fee);
  return fee;
}

function addDashDate(date) {
  return date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6, 8);
}

function getRealStatus(status, dueDt) {
  let realStatus;
  if (status === 'A') {
    realStatus = 'investing';
  } else if (status === 'E') {
    realStatus = 'done';
  } else if (status === 'B') {
    // 연체일 계산
    let todayObj = new Date(getToday('-')); // UTC
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
    UP1: '경공업',
    UP2: '중공업',
    UP3: '건설업',
    UP4: '도소매업',
    UP5: '기타서비스업'
  };
  return upcd2BizType[upcd];
}

module.exports = {
  main
};

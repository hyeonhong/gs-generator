// load common module
const {
  get,
  post,
  sleep,
  getToday,
  getDate,
  getWeightedAvg,
  addDashDate
} = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');

const moment = require('moment');

async function main(productNo) {
  // productNo = 1454;  // 426, 1454

  // query table: ups_info_etc
  var form = {
    select: 'ups_info_no',
    ups_no: 'eq.' + productNo
  };
  let upsInfoEtc = await db.fetch('ups_info_etc', form);
  let upsNo = upsInfoEtc[0].ups_info_no;
  // validity check for product_no
  if (!upsInfoEtc.length) {
    // empty result
    let result = {
      error: {
        code: 404,
        message: 'product_no not found'
      }
    };
    return result;
  }

  // query table: ups_info
  var form = {
    select: 'sta, due_inv_dt, inv_ratio, due_dt, out_dt, out_mny, disc_mny, b_upcd, fee_ratio',
    no: 'eq.' + upsNo
  };
  let upsInfo = await db.fetch('ups_info', form);
  let dueInvDt = upsInfo[0].due_inv_dt;
  let upsStatus = upsInfo[0].sta;
  let invRatio = upsInfo[0].inv_ratio;
  let dueDt = upsInfo[0].due_dt;
  let outDt = upsInfo[0].out_dt;
  let outMny = upsInfo[0].out_mny;
  let discMny = upsInfo[0].disc_mny;
  let roughFeeRatio = upsInfo[0].fee_ratio;
  let bizType = getBizType(upsInfo[0].b_upcd);
  let productName = `${bizType} ${productNo}호`;
  let loanDays = null;
  if (dueDt && outDt) {
    // if both have values
    let dueDtObj = new Date(addDashDate(dueDt));
    let outDtObj = new Date(addDashDate(outDt));
    loanDays = (dueDtObj - outDtObj) / (1000 * 60 * 60 * 24);
  }

  let pageUrl;
  let productionServers = ['production', 'as1', 'as2', 'as3'];
  if (productionServers.includes(process.env.GS_ENV)) {
    pageUrl = `https://90days.kr/finnq/invDetail?no=${upsNo}`;
  } else {
    pageUrl = `https://dev-finnq.example.com/finnq/invDetail?no=${upsNo}`;
  }

  let preItem = {
    product_no: productNo, // 상품번호
    repay_count: 0, // 상환회차
    max_repay_count: 1, // 전체상환회차
    name: productName, // 상품명
    date: moment(outDt).format() || null, // 투자시작일 (대출지급일, timestamp)
    cancelled_date: null, // 모집취소일 (timestamp)
    funding_done_date: null, // 모집완료일 (대출지급일, timestamp)
    published_rate: invRatio || null, // 상품수익률 (게시 수익률)
    profit_rate: null, // 세후수익률 (실수익률)
    days: loanDays, // 투자일수
    issue_date: moment(dueDt).format() || null, // 만기일 (timestamp)
    return_date: moment(dueInvDt).format() || null, // 상환예정일 (timestamp)
    repay_done_date: null, // 상환완료일 (timestamp)
    status: null, // 상품상태
    invested: null, // 투자금액
    fund_amount: outMny || null, // 상품모집금액
    repaid: null, // 상환완료금액
    expected: null, // 상환예정금액
    fee: null, // 수수료 금액
    tax: null, // 세금
    net_profit: null, // 세후 이자
    page_url: pageUrl // 투자상품 URL
  };
  // 거절
  if (upsStatus === 'R' || upsStatus === 'X' || upsStatus === 'N') {
    // query table: ups_info_sta
    var form = {
      select: 'save_dt, save_tm',
      ups_info_no: 'eq.' + upsNo,
      sta: 'eq.' + upsStatus
    };
    let upsInfoSta = await db.fetchRaw('ups_info_sta', form);
    let cancelledDt = upsInfoSta[0].save_dt;
    let cancelledTm = upsInfoSta[0].save_tm;

    preItem.cancelled_date = moment(cancelledDt + 'T' + cancelledTm).format();
    preItem.status = 'rejected';
    return preItem;
  }
  // 접수됨
  if (upsStatus === 'A') {
    preItem.status = 'registered';
    return preItem;
  }
  // 심사중
  if (upsStatus === 'B' || upsStatus === 'C' || upsStatus === 'D' || upsStatus === 'E') {
    preItem.status = 'evaluating';
    return preItem;
  }

  // query table: ups_inv_info
  var form = {
    select: 'no, trade_money, p_fee_rate',
    ups_info_no: 'eq.' + upsNo
  };
  let upsInvInfo = await db.fetch('ups_inv_info', form);
  let investmentAmt = 0;
  upsInvInfo.forEach(function(arr) {
    investmentAmt += arr.trade_money;
  });

  // 모집중
  if (upsStatus === 'F' || upsStatus === 'G' || upsStatus === 'H' || upsStatus === 'I') {
    // get returnInterest
    let param = {
      tradeMoney: outMny,
      outMny: outMny,
      outDate: outDt,
      loanPeriod: loanDays,
      discMny: discMny,
      feeRatio: roughFeeRatio
    };
    let returnInfo = getReturnInfo(param);
    let returnInterest = returnInfo.returnInterest;
    let fee = returnInfo.fee;
    let tax = returnInfo.tax;

    preItem.invested = investmentAmt;
    preItem.expected = outMny + returnInterest + tax; // 상환예정금액
    preItem.status = upsStatus === 'F' ? 'funding' : 'funded';

    // console.log(preItem);
    return preItem;
  }

  // 대출중

  // query table: erp_contract_info
  var form = {
    select: 'no, ups_info_no, sta, cont_term, cont_attr1',
    ups_no: 'eq.' + productNo
  };
  let erpContractInfo = await db.fetch('erp_contract_info', form);
  if (!erpContractInfo.length) {
    return {
      error: {
        code: 404,
        message: 'No corresponding record exists in erp_contract_info.'
      }
    };
  }
  let erpNo = erpContractInfo[0].no;
  let status = erpContractInfo[0].sta;
  let loanPeriod = parseInt(erpContractInfo[0].cont_term);
  let bankruptcyFlag = erpContractInfo[0].cont_attr1;

  // query table: cus_member_loan_log
  var form = {
    select: 'save_dt, save_tm, member_no',
    order: 'save_dt.desc, save_tm.desc', // most recent
    loan_flag: 'eq.' + 'Y'
  };
  let cusMemberLoanLog = await db.fetchRaw('cus_member_loan_log', form);

  // query table: erp_out_mny
  var form = {
    select: 'save_tm',
    contract_info_no: 'eq.' + erpNo
  };
  let erpOutMny = await db.fetch('erp_out_mny', form);
  let outTm = erpOutMny[0].save_tm;

  // query table: erp_inv_info
  var form = {
    select: 'no, p_fee_rate, trade_money, member_no',
    contract_info_no: 'eq.' + erpNo
  };
  let erpInvInfo = await db.fetch('erp_inv_info', form);
  let erpInvInfoNos = [];
  erpInvInfo.forEach(function(arr) {
    let erpInvInfoNo = arr.no;
    erpInvInfoNos.push(erpInvInfoNo);
  });

  // query table: ups_info_sta
  var form = {
    select: 'save_dt, save_tm',
    ups_info_no: 'eq.' + upsNo,
    sta: 'eq.' + 'I' // I: 모집완료
  };
  let upsInfoSta = await db.fetchRaw('ups_info_sta', form);
  let fundingCompleteDt = upsInfoSta[0].save_dt;
  let fundingCompleteTm = upsInfoSta[0].save_tm;

  let item = {
    product_no: productNo, // 상품번호
    repay_count: 0, // 상환회차
    max_repay_count: 1, // 전체상환회차
    name: productName, // 상품명
    date: moment(outDt + 'T' + outTm).format(), // 투자시작일 (대출지급일, timestamp)
    cancelled_date: null, // 모집취소일 (timestamp)
    funding_done_date: moment(fundingCompleteDt + 'T' + fundingCompleteTm).format(), // 모집완료일 (대출지급일, timestamp)
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
    page_url: pageUrl // 투자상품 URL
  };

  // query table: inv_income_return
  var form = {
    select:
      'erp_inv_info_no, return_origin, return_interest, local_tax, income_tax, p_fee, trade_dt, trade_tm',
    erp_inv_info_no: `in.(${erpInvInfoNos.join()})`,
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
  let erpInvInfoNo2ReturnOrigin = {};
  invIncomeReturn.forEach(function(arr) {
    let erpInvInfoNo = arr.erp_inv_info_no;
    if (!erpInvInfoNos.includes(erpInvInfoNo)) {
      // check if erpNo matches
      return; // 'continue' to next iteration
    } else {
      erpInvInfoNo2ReturnOrigin[erpInvInfoNo] = erpInvInfoNo2ReturnOrigin[erpInvInfoNo] || 0;
      erpInvInfoNo2ReturnOrigin[erpInvInfoNo] += arr.return_origin;
    }

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
  let expectedAmt = 0;
  if (status !== 'E') {
    erpInvInfo.forEach(function(arr) {
      // erpNo already matched
      let erpInvInfoNo = arr.no;
      let partialInvestmentAmt = arr.trade_money; // 투자금액
      let currentPartialReturnOrigin = erpInvInfoNo2ReturnOrigin[erpInvInfoNo];
      if (currentPartialReturnOrigin) {
        // 상환금액이 있으면
        partialInvestmentAmt -= currentPartialReturnOrigin;
      }
      if (!partialInvestmentAmt) {
        // 완전상환 되었으면
        return; // 'continue' to next iteration
      }

      // get isProfessional
      let isProfessional = false;
      for (const record of cusMemberLoanLog) {
        if (record.member_no !== arr.member_no) {
          continue;
        }
        let saveDt = record.save_dt;
        // let saveTm = record.save_tm;
        if (saveDt <= dueDt) {
          isProfessional = true;
          break;
        }
      }

      // get returnInterest
      let param = {
        tradeMoney: partialInvestmentAmt,
        outMny: outMny,
        outDate: outDt,
        loanPeriod: loanPeriod,
        discMny: discMny,
        feeRatio: arr.p_fee_rate,
        isProfessional: isProfessional
      };
      let returnInfo = getReturnInfo(param);
      let returnInterest = returnInfo.returnInterest;
      let fee = returnInfo.fee;
      let tax = returnInfo.tax;

      expectedAmt += partialInvestmentAmt + returnInterest + tax; // 상환예정금액
    });
  }
  item.expected = expectedAmt;

  item.status = getRealStatus(status, dueDt);
  // console.log(item);
  return item;
}

function getReturnInfo(param) {
  let { tradeMoney, outMny, discMny, feeRatio, outDate, loanPeriod, isProfessional } = param;

  // let tradeMoney = rightRow['trade_money'];
  let ratio = tradeMoney / outMny;
  let divOrigin = Math.trunc(outMny * ratio);
  let divInterest = Math.trunc(discMny * ratio);
  // let feeRatio = rightRow['p_fee_rate'];
  let fee = getFee(feeRatio, outDate, loanPeriod, divOrigin, divInterest);
  let interestBeforeTax = divInterest - fee; // 수수료 차감후, <투자자> 이자 (세전)

  // calculate tax
  // 1. get loanFlag

  let incomeTax = 0;
  let localTax = 0;
  if (isProfessional) {
    incomeTax = 0;
    localTax = 0;
  } else {
    incomeTax = Math.trunc(interestBeforeTax * 0.025) * 10; // 소득세
    localTax = Math.trunc(incomeTax * 0.01) * 10; // 지방세
  }
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

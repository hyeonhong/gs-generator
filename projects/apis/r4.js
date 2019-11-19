
// load common module
const { get, post, sleep, getToday, getDate, getWeightedAvg } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');


async function main(memberNo) {
  // memberNo = 57;
  // memberNo = 3895;  // 3895, 4063, 4141, 4197, 4266

  let isValidMember = await db.validateMember(memberNo);
  if (!isValidMember) {
    return {
      error: {
        code: 404,
        message: 'The member_no is not valid, or the member has not completed the authentication process.'
      }
    };
  }

  // query table: cus_member
  var form = {
    select: 'pc_div',
    no: 'eq.' + memberNo
  };
  let cusMember = await db.fetch('cus_member', form);
  let memberType = cusMember[0].pc_div;

  let investorType;
  if (memberType === 'P') {
    // query table: cus_priv
    var form = {
      select: 'pro_investor',
      member_no: 'eq.' + memberNo
    };
    let cusPrivOrCorp = await db.fetch('cus_priv', form);
    investorType = cusPrivOrCorp[0].pro_investor;
  }

  // query table: inv_list
  var form = {
    select: 'inv_tail_money, inv_money, app_return_money',
    member_no: 'eq.' + memberNo,
  };
  let invList = await db.fetch('inv_list', form);

  // query table: cus_member_loan_log
  var form = {
    select: 'loan_flag, save_dt, save_tm',
    order: 'save_dt.desc, save_tm.desc',  // most recent
    member_no: 'eq.' + memberNo
    // save_dt: 'lte.' + date
  };
  let cusMemberLoanLog = await db.fetchRaw('cus_member_loan_log', form);

  // query table: erp_contract_info
  var form = {
    select: 'no, sta, cont_term, cont_attr1, total_loan_mny, out_dt, disc_mny, return_dt'
  };
  let erpContractInfo = await db.fetch('erp_contract_info', form);
  let erpNo2Row = {};
  erpContractInfo.map(function (arr) {
    let erpNo = arr.no;
    erpNo2Row[erpNo] = arr;
  });

  // query table: erp_inv_info
  var form = {
    select: 'no, contract_info_no, trade_money, p_fee_rate',
    member_no: 'eq.' + memberNo,
  };
  let erpInvInfo = await db.fetch('erp_inv_info', form);
  let totalInvestAmt = 0;
  let totalInvestCount = 0;
  let totalBankruptcyAmt = 0;
  let totalBankruptcyCount = 0;
  let totalBankruptcyReturnOriginDone = 0;
  let totalBankruptcyCountDone = 0;
  let erpInvInfoNo2ErpNo = {};
  let totalExpectedReturnAmt = 0;
  let totalExpectedReturnAmtBankrupt = 0;
  let totalExpectedFee = 0;
  let totalExpectedTax = 0;
  let totalExpectedNetProfit = 0;
  erpInvInfo.forEach(function (arr) {
    let erpNo = arr.contract_info_no;
    let erpInvInfoNo = arr.no;
    erpInvInfoNo2ErpNo[erpInvInfoNo] = erpNo;

    if (erpNo2Row[erpNo]['sta'] !== 'E') {
      totalInvestAmt += arr.trade_money;
      totalInvestCount++;

      // get loanFlag
      let loanFlag = '';
      for (const record of cusMemberLoanLog) {
        let saveDt = record.save_dt;
        let dueDt = erpNo2Row[erpNo]['return_dt'];
        // let saveTm = record.save_tm;
        if (saveDt <= dueDt) {
          loanFlag = record.loan_flag;
          break;
        }
      }
      let isProfessional = (loanFlag === 'Y');

      // get returnInterest
      let param = {
        tradeMoney: arr.trade_money,
        outMny: erpNo2Row[erpNo]['total_loan_mny'],
        outDate: erpNo2Row[erpNo]['out_dt'],
        loanPeriod: parseInt(erpNo2Row[erpNo]['cont_term']),
        discMny: erpNo2Row[erpNo]['disc_mny'],
        feeRatio: arr.p_fee_rate,
        isProfessional: isProfessional,
      }
      let returnInfo = getReturnInfo(param);
      let returnInterest = returnInfo.returnInterest;
      let fee = returnInfo.fee;
      let tax = returnInfo.tax;

      if (erpNo2Row[erpNo]['sta'] === 'B') {  // 부도건
        totalBankruptcyAmt += arr.trade_money;
        totalBankruptcyCount++;
        totalExpectedReturnAmtBankrupt += arr.trade_money + returnInterest;  // 세금 제외
      } else {  // 부도아닌 정상 상환예정 건
        totalExpectedReturnAmt += arr.trade_money + returnInterest + tax;
        totalExpectedTax += tax;
      }

      totalExpectedFee += fee;
      totalExpectedNetProfit += returnInterest;
      // } else if (erpNo2Row[erpNo]['sta'] === 'E' && erpNo2Row[erpNo]['cont_attr1']) { // 상환완료 부도건
      //   totalBankruptcyReturnOriginDone += arr.trade_money;
      //   totalBankruptcyCountDone++;
    }
  });

  // query table: inv_income_return
  var form = {
    select: 'erp_inv_info_no, return_origin, return_interest, local_tax, income_tax, p_fee',
    member_no: 'eq.' + memberNo,
    sta: 'eq.' + 'C'
  };
  let invIncomeReturn = await db.fetch('inv_income_return', form);

  let rejectInvestAmt = 0;        // 33 added. This money was invested in cancel product.
  let rejectInvestCount = 0;      // 33 added. This count was invested in cancel product.
  let totalReturnOrigin = 0;  // used for weighted avg calculation
  let totalReturnCount = 0;  // 총 분배 건수
  let wAvgInvRatio = 0;  // 세후 수익률
  let wAvgInvRatioBeforeTax = 0;  // 세전 수익률
  let totalReturnInterest = 0;  // 세후이자금액
  let totalReturnedAmt = 0;  // 분배완료금액
  let totalTax = 0;  // 세금
  let totalFee = 0;  // 수수료 금액
  let totalPartialReturnOrigin = 0;  // 부분 상환 원금
  let totalPartialReturnInterest = 0;  // 부분 상환 이자
  let totalPartialTax = 0;  // 부분 상환 세금
  let totalPartialFee = 0;  // 부분 상환 수수료

  invIncomeReturn.forEach(function (arr) {
    let erpInvInfoNo = arr.erp_inv_info_no;
    let erpNo = erpInvInfoNo2ErpNo[erpInvInfoNo];
    let status = erpNo2Row[erpNo]['sta'];
    if (status !== 'E') {  // 부분 상환
      totalPartialReturnOrigin += arr.return_origin;
      totalPartialReturnInterest += arr.return_interest;
      totalPartialTax += arr.income_tax + arr.local_tax;
      totalPartialFee += arr.p_fee;
      return;  // move to next iteration
    }

    let returnOrigin = arr.return_origin;
    let returnInterest = arr.return_interest;
    let returnInterestBeforeTax = arr.return_interest + arr.income_tax + arr.local_tax;
    let loanPeriod = parseInt(erpNo2Row[erpNo]['cont_term']);

    let invRatio = returnInterest / returnOrigin * (365 / loanPeriod) * 100;
    let invRatioBeforeTax = returnInterestBeforeTax / returnOrigin * (365 / loanPeriod) * 100;
    wAvgInvRatio = getWeightedAvg(invRatio, returnOrigin, totalReturnOrigin, wAvgInvRatio);
    wAvgInvRatioBeforeTax = getWeightedAvg(invRatioBeforeTax, returnOrigin, totalReturnOrigin, wAvgInvRatioBeforeTax);
    totalReturnOrigin += returnOrigin;
    totalReturnInterest += returnInterest;
    totalReturnedAmt += returnOrigin + returnInterest;
    totalTax += arr.income_tax + arr.local_tax;
    totalFee += arr.p_fee;
    totalReturnCount++;
  });


  // query table: ups_inv_info
  var form = {
    select: 'ups_info_no, trade_money',
    member_no: 'eq.' + memberNo,
    save_sta: 'eq.' + 'C',
    del_id: 'eq.SYSTEM'
  };
  let upsInvInfoReject = await db.fetchRaw('ups_inv_info', form);

  // query table: ups_info
  var form = {
    select: 'no',
    sta: 'in.(N,R,X)',
  };
  let upsInfoReject = await db.fetch('ups_info', form);
  let upsNo2Row = upsInfoReject.map(function (arr) {
    return arr.no;
  });

  for (const i of upsInvInfoReject.keys()) {
    let upsNo = upsInvInfoReject[i]['ups_info_no'];
    if (upsNo2Row.includes(upsNo)) {
      rejectInvestCount++;
      rejectInvestAmt += upsInvInfoReject[i]['trade_money'];
    }
  }

  // query table: ups_inv_info
  var form = {
    select: 'ups_info_no, trade_money',
    member_no: 'eq.' + memberNo,
  };
  let upsInvInfo = await db.fetch('ups_inv_info', form);

  // query table: ups_info
  var form = {
    select: 'no',
    sta: 'in.(F,G,H,I)',
  };
  let upsInfo = await db.fetch('ups_info', form);
  let upsNosPending = upsInfo.map(function (arr) {
    return arr.no;
  });

  // 투자건수
  let pendingInvCount = 0;
  let pendingInvAmt = 0;
  for (const i of upsInvInfo.keys()) {
    let upsNo = upsInvInfo[i]['ups_info_no'];
    if (upsNosPending.includes(upsNo)) {
      pendingInvCount++;
      pendingInvAmt += upsInvInfo[i]['trade_money'];
    }
  }

  // check to see if pending investment amount matches
  // let pendingInvAmtReal = invList[0].inv_money || 0;
  // if (pendingInvAmt !== pendingInvAmtReal) {
  //   console.log(pendingInvAmt, pendingInvAmtReal);
  //   throw new Error('pending investment amount does not match');
  // }


  let param = investorType || memberType;
  let LimitAmt = getLimitAmt(param);

  let result = {
    avg_yield: parseFloat(wAvgInvRatioBeforeTax.toFixed(3)),  // 평균세전수익율
    avg_profit: parseFloat(wAvgInvRatio.toFixed(3)),  // 평균세후수익율
    deposit: invList[0].inv_tail_money || 0,  // 예치금
    pending_withdrawal: invList[0].app_return_money || 0,  // 출금진행중금액
    remain_capacity: LimitAmt - totalInvestAmt,  // 잔여한도금액
    pending: {
      invested: invList[0].inv_money || 0,  // 투자금액
      count: pendingInvCount,  // 투자건수
    },
    reject: {
      invested: rejectInvestAmt || 0,  // 취소상품 투자금액
      count: rejectInvestCount,  // 취소상품 투자건수
    },
    investing: {
      invested: totalInvestAmt,  // 투자금액
      count: totalInvestCount,  // 투자건수
      delayed_count: totalBankruptcyCount,  // 연체건수
      profit: totalPartialReturnInterest,  // 세후이자금액 (상환완료건)
      returned: totalPartialReturnOrigin + totalPartialReturnInterest + totalPartialTax,  // 상환완료금액
      expected: totalExpectedReturnAmt,  // 상환예정금액 (정상)
      delayed_expected: totalExpectedReturnAmtBankrupt,  // 상환예정 연체금액
      fee: totalPartialFee,  // 수수료 금액 (상환완료건)
      tax: totalPartialTax,  // 세금 (상환완료건)
      expected_fee: totalExpectedFee,
      expected_tax: totalExpectedTax,
      expected_net_profit: totalExpectedNetProfit,
    },
    done: {
      invested: totalReturnOrigin,  // 투자금액
      count: totalReturnCount + totalBankruptcyCount,  // 투자건수
      bankrupted_count: totalBankruptcyCountDone,  // 부도건수
      profit: totalReturnInterest,  // 세후이자금액
      returned: totalReturnedAmt + totalTax,  // 상환완료금액
      bankrupted_amount: totalBankruptcyReturnOriginDone,  // 부도원금
      fee: totalFee,  // 수수료 금액
      tax: totalTax,  // 세금
    }
  }

  result.remain_capacity = infinityToValue(result.remain_capacity);

  // console.log(result);
  return result;
}

function getLimitAmt(memberType) {
  if (memberType === 'C') {  // investorType === 'C' || memberType === 'C'
    return Number.POSITIVE_INFINITY;
  } else if (memberType === 'A' || memberType === 'B' || memberType === 'D') {
    return 20000000;
  } else if (memberType === 'E') {
    return 40000000;
  } else {
    throw new Error('Illegal memberType value');
  }
}

function getReturnInfo(param) {
  let { tradeMoney, outMny, discMny, feeRatio, outDate, loanPeriod, isProfessional } = param;

  // let tradeMoney = rightRow['trade_money'];
  let ratio = tradeMoney / outMny;
  let divOrigin = Math.trunc(outMny * ratio);
  let divInterest = Math.trunc(discMny * ratio);
  // let feeRatio = rightRow['p_fee_rate'];
  let fee = getFee(feeRatio, outDate, loanPeriod, divOrigin, divInterest);
  let interestBeforeTax = divInterest - fee;  // 수수료 차감후, <투자자> 이자 (세전)

  // calculate tax
  // 1. get loanFlag

  let incomeTax = 0;
  let localTax = 0;
  if (isProfessional) {
    incomeTax = 0;
    localTax = 0;
  } else {
    incomeTax = Math.trunc(interestBeforeTax * 0.025) * 10;  // 소득세
    localTax = Math.trunc(incomeTax * 0.01) * 10;  // 지방세
  }
  let interestAfterTax = interestBeforeTax - incomeTax - localTax;	// 세금 차감후, <투자자> 이자 (세후)
  let returnInfo = {
    returnInterest: interestAfterTax,
    fee: fee,
    tax: incomeTax + localTax
  }
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
  let fee = (divOrigin + divInterest) * feeRatio / 100;
  fee = Math.trunc(fee);
  return fee;
}

function infinityToValue(value) {
  if (value === Number.POSITIVE_INFINITY) {
    return -1;
  } else {
    return value;
  }
}


module.exports = {
  main
}

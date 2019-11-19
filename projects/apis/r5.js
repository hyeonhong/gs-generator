
// load common module
const { get, post, sleep, getToday, getDate, getWeightedAvg } = require('../../lib/common.js');

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

  // query table: erp_contract_info
  var form = {
    select: 'no, ups_info_no, sta, cont_term, cont_attr1, total_loan_mny, out_dt, disc_mny, return_dt, ups_no, b_upcd'
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
    select: 'no, contract_info_no, trade_money, p_fee_rate',
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
  let partialReturnErpInvInfo = {};
  // 부분상환건
  invIncomeReturn.forEach(function (arr) {
    let erpInvInfoNo = arr.erp_inv_info_no;
    let erpNo = erpInvInfoNo2ErpNo[erpInvInfoNo];
    let status = erpNo2Row[erpNo]['sta'];
    if (status === 'E') {  // 완전 상환
      return;  // move to next iteration
    }

    // 부분 상환 only
    partialReturnErpInvInfo[erpInvInfoNo] = partialReturnErpInvInfo[erpInvInfoNo] || 0;
    partialReturnErpInvInfo[erpInvInfoNo] += arr.return_origin;

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
      status: status,  // 상품상태
      invested: returnOrigin,  // 투자금액
      // fund_amount: erpNo2Row[erpNo]['total_loan_mny'],  // 상품모집금액
      repaid: returnOrigin + returnInterestBeforeTax,  // 상환완료금액
      expected: null,  // 상환예정금액
      fee: arr.p_fee,  // 수수료 금액
      tax: arr.income_tax + arr.local_tax,  // 세금
      net_profit: returnInterestBeforeTax - arr.income_tax - arr.local_tax,  // 세후 이자
      expected_fee: 0,
      expected_tax: 0,
      expected_net_profit: 0
    };

    item.status = getRealStatus(status, dueDt);

    items.push(item);
  });

  // 미상환건
  erpInvInfo.forEach(function (arr) {
    let erpNo = arr.contract_info_no;
    let erpInvInfoNo = arr.no;
    let status = erpNo2Row[erpNo]['sta'];

    if (status !== 'E') {

      let tradeMoney = arr.trade_money;
      let partialReturnOrigin = partialReturnErpInvInfo[erpInvInfoNo];
      if (partialReturnOrigin) {  // 부분 상환된 경우
        tradeMoney -= partialReturnOrigin;
      }

      let upsNo = erpNo2UpsNo[erpNo];
      let upsInvInfoRow = upsNo2UpsInvInfoRow[upsNo];
      let saveDt = upsInvInfoRow['save_dt'];
      let saveTm = upsInvInfoRow['save_tm'];
      let upsRow = upsNo2Row[upsNo];

      let outMny = erpNo2Row[erpNo]['total_loan_mny'];
      let loanPeriod = parseInt(erpNo2Row[erpNo]['cont_term']);
      let dueDt = erpNo2Row[erpNo]['return_dt'];
      let outDt = erpNo2Row[erpNo]['out_dt'];
      let outTm = erpNo2OutTm[erpNo];

      // get returnInterest
      let param = {
        tradeMoney: tradeMoney,
        outMny: outMny,
        outDate: outDt,
        loanPeriod: loanPeriod,
        discMny: erpNo2Row[erpNo]['disc_mny'],
        feeRatio: arr.p_fee_rate,
      }
      let returnInfo = getReturnInfoNoProCheck(param);
      let returnInterest = returnInfo.returnInterest;
      let fee = returnInfo.fee;
      let tax = returnInfo.tax;
      let realInvRatio = returnInterest / tradeMoney * (365 / loanPeriod) * 100;


      let item = {
        invested_no: upsInvInfoRow['no'],  // 투자번호
        product_no: erpNo2Row[erpNo]['ups_no'],  // 상품번호
        repay_count: 0,  // 상환회차
        max_repay_count: null,  // 전체상환회차  
        name: `${getBizType(erpNo2Row[erpNo]['b_upcd'])} ${erpNo2Row[erpNo]['ups_no']}호`,  // 상품명
        invested_at: moment(saveDt + 'T' + saveTm).format(),  // 투자입력일 (timestamp)
        date: moment(outDt + 'T' + outTm).format(),  // 투자시작일 (대출지급일, timestamp)
        published_rate: upsInvInfoRow['ratio'],  // 상품수익률 (게시 수익률)
        profit_rate: null,  // 세후수익률 (실수익률)
        days: loanPeriod,  // 투자일수
        issue_date: moment(dueDt).format(),  // 만기일 (timestamp)
        return_date: moment(upsRow['due_inv_dt']).format(),  // 상환예정일 (timestamp)
        repay_done_date: null,  // 상환완료일 (timestamp)
        status: status,  // 상품상태
        invested: tradeMoney,  // 투자금액
        // fund_amount: outMny,  // 상품모집금액
        repaid: null,  // 상환완료금액
        expected: tradeMoney + returnInterest + tax,  // 상환예정금액
        fee: null,  // 수수료 금액
        tax: null,  // 세금
        net_profit: null,  // 세후 이자
        expected_fee: fee,
        expected_tax: tax,
        expected_net_profit: returnInterest
      };

      item.status = getRealStatus(status, dueDt);

      items.push(item);
    }
  });

  // filter duplicate upsInvInfoNo
  let upsInvInfoNo2Items = {};
  items.forEach(function (item) {
    let upsInvInfoNo = item.invested_no;
    upsInvInfoNo2Items[upsInvInfoNo] = upsInvInfoNo2Items[upsInvInfoNo] || [];
    upsInvInfoNo2Items[upsInvInfoNo].push(item);
  });
  let itemsFiltered = [];
  for (const upsInvInfoNo of Object.keys(upsInvInfoNo2Items)) {
    let arr = upsInvInfoNo2Items[upsInvInfoNo];
    if (arr.length === 1) {  // full 미상환
      itemsFiltered.push(arr[0]);
    } else {  // 부분 상환
      let filteredItem;
      let returnCount = 0;
      let returnDate = moment(0);
      let returnCompleteAmt = 0;
      let fee = 0;
      let tax = 0;
      let netProfit = 0;
      let wAvgInvRatio = 0;  // 세후수익률 (실수익률)
      let totalWeight = 0;  // 투자금액 합
      let expectedFee = 0;  // 예측 수수료
      let expectedTax = 0;  // 예측 세금
      let expectedNetProfit = 0;  // 예측 실수익금

      for (const item of arr) {
        if (item.repay_count === 0) {  // 미상환건 - only one item
          filteredItem = Object.assign({}, item);  // Copy object
        } else {  // 상환건 - possibily multiple items
          returnCount = Math.max(returnCount, item.repay_count);  // 상환 회차
          returnDate = moment.max(returnDate, moment(item.repay_done_date));  // 상환완료일
          returnCompleteAmt += item.repaid;  //상환완료금액
          fee += item.fee;  // 수수료 금액
          tax += item.tax;  // 세금
          netProfit += item.net_profit;  // 세후 이자
          wAvgInvRatio = getWeightedAvg(item.profit_rate, item.invested, totalWeight, wAvgInvRatio);
          totalWeight += item.invested;  // 투자금액 합
          expectedFee += item.expected_fee;
          expectedTax += item.expected_tax;
          expectedNetProfit += item.expected_net_profit;
        }
      }

      filteredItem.repay_count = returnCount;
      filteredItem.max_repay_count = 1;
      filteredItem.profit_rate = parseFloat((wAvgInvRatio).toFixed(3));
      filteredItem.repay_done_date = returnDate.format();
      filteredItem.repaid = returnCompleteAmt;
      filteredItem.fee = fee;
      filteredItem.tax = tax;
      filteredItem.net_profit = netProfit;
      filteredItem.expected_fee = expectedFee;
      filteredItem.expected_tax = expectedTax;
      filteredItem.expected_net_profit = expectedNetProfit;

      // console.log(filteredItem);
      itemsFiltered.push(filteredItem);
    }
  }

  // console.log(itemsFiltered);
  return itemsFiltered;
}

function getReturnInfoNoProCheck(param) {
  let { tradeMoney, outMny, discMny, feeRatio, outDate, loanPeriod } = param;

  // let tradeMoney = rightRow['trade_money'];
  let ratio = tradeMoney / outMny;
  let divOrigin = Math.trunc(outMny * ratio);
  let divInterest = Math.trunc(discMny * ratio);
  // let feeRatio = rightRow['p_fee_rate'];
  let fee = getFee(feeRatio, outDate, loanPeriod, divOrigin, divInterest);
  let interestBeforeTax = divInterest - fee;  // 수수료 차감후, <투자자> 이자 (세전)

  // calculate tax
  let incomeTax = Math.trunc(interestBeforeTax * 0.025) * 10;  // 소득세
  let localTax = Math.trunc(incomeTax * 0.01) * 10;  // 지방세
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

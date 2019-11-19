// load common module
const { get, post, sleep, getToday, getDate } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');

const moment = require('moment');

async function main({ productNo, memberNo, investmentAmt }) {
  // memberNo = 57;
  // memberNo = 3895;  // 3895, 4063, 4141, 4197, 4266

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
    select: 'out_mny, out_dt, disc_mny, due_dt, due_inv_dt, b_upcd, fee_ratio, inv_ratio, sta',
    sta: 'in.(F,G,H,I)',
    no: 'eq.' + upsNo
  };
  let upsInfo = await db.fetch('ups_info', form);
  // validity check for sta
  if (!upsInfo.length) {
    // empty result
    let result = {
      error: {
        code: 404,
        message: `ups_info.sta is not 'F', 'G', 'H' or 'I'.`
      }
    };
    return result;
  }
  let outDt = upsInfo[0].out_dt;
  let dueDt = upsInfo[0].due_dt;
  let dueInvDt = upsInfo[0].due_inv_dt;
  let outMny = upsInfo[0].out_mny;
  let discMny = upsInfo[0].disc_mny;
  let status = upsInfo[0].sta;
  let bizType = getBizType(upsInfo[0].b_upcd);

  // get loanPeriod
  let outDtObj = new Date(addDashDate(outDt));
  let dueDtObj = new Date(addDashDate(dueDt));
  let loanPeriod = (dueDtObj - outDtObj) / (1000 * 60 * 60 * 24);

  let upsInvInfoNo = null;
  let feeRatio = upsInfo[0].fee_ratio;
  let invRatio = upsInfo[0].inv_ratio;
  let saveTime = moment().format();
  if (!investmentAmt) {
    // query table: ups_inv_info
    var form = {
      select: 'no, trade_money, p_fee_rate, ratio, save_dt, save_tm',
      member_no: 'eq.' + memberNo,
      ups_info_no: 'eq.' + upsNo
    };
    let upsInvInfo = await db.fetch('ups_inv_info', form);
    // validity check for matching record
    if (!upsInvInfo.length) {
      let result = {
        error: {
          code: 404,
          message: 'There is no corresponding record in ups_inv_info.'
        }
      };
      return result;
    }
    upsInvInfoNo = upsInvInfo[0].no;
    feeRatio = upsInvInfo[0].p_fee_rate;
    invRatio = upsInvInfo[0].ratio;
    investmentAmt = upsInvInfo[0].trade_money;
    let saveDt = upsInvInfo[0].save_dt;
    let saveTm = upsInvInfo[0].save_tm;
    saveTime = moment(saveDt + 'T' + saveTm).format();
  }

  // query table: cus_member_loan_log
  var form = {
    select: 'save_dt, save_tm',
    loan_flag: 'eq.' + 'Y',
    member_no: 'eq.' + memberNo
  };
  let cusMemberLoanLog = await db.fetchRaw('cus_member_loan_log', form);
  let isProfessional = cusMemberLoanLog.length > 0;

  // get returnInterest
  let divRatio = investmentAmt / outMny;
  let divOrigin = Math.trunc(outMny * divRatio);
  let divInterest = Math.trunc(discMny * divRatio);
  let fee = getFee(feeRatio, outDt, loanPeriod, divOrigin, divInterest);
  let interestBeforeTax = divInterest - fee; // 수수료 차감후, <투자자> 이자 (세전)
  // calculate tax
  let incomeTax = 0;
  let localTax = 0;
  if (!isProfessional) {
    incomeTax = Math.trunc(interestBeforeTax * 0.025) * 10; // 소득세
    localTax = Math.trunc(incomeTax * 0.01) * 10; // 지방세
  }
  let returnInterest = interestBeforeTax - incomeTax - localTax; // 세금 차감후, <투자자> 이자 (세후)
  let realInvRatio = (returnInterest / investmentAmt) * (365 / loanPeriod) * 100;

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
    invested_at: saveTime, // 투자입력일 (timestamp)
    date: moment(outDt + 'T180000').format(), // 투자시작일 (대출지급일, timestamp)
    published_rate: invRatio, // 상품수익률 (게시 수익률)
    profit_rate: parseFloat(realInvRatio.toFixed(3)), // 세후수익률 (실수익률)
    days: loanPeriod, // 투자일수
    issue_date: moment(dueDt).format(), // 만기일 (timestamp)
    return_date: moment(dueInvDt).format(), // 상환예정일 (timestamp)
    repay_done_date: null, // 상환완료일 (timestamp)
    status: status === 'F' ? 'funding' : 'funded', // 상품상태
    invested: investmentAmt, // 투자금액
    fund_amount: outMny, // 상품모집금액
    repaid: 0, // 상환완료금액
    expected: investmentAmt + interestBeforeTax, // 상환예정금액
    expected_fee: fee, // 수수료 금액
    expected_tax: incomeTax + localTax, // 세금
    expected_net_profit: returnInterest, // 세후 이자
    paper_url: paperUrl, // 원리금수취권증서 URL
    page_url: pageUrl // 투자상품 URL
  };

  // console.log(item);
  return item;
}

function getFee(feeRatio, outDate, loanPeriod, divOrigin, divInterest) {
  outDate = addDashDate(outDate);
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

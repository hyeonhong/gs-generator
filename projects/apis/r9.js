
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
    select: 'no, ups_info_no, trade_money, p_fee_rate, ratio, save_dt, save_tm',
    member_no: 'eq.' + memberNo,
  };
  let upsInvInfo = await db.fetch('ups_inv_info', form);

  // query table: ups_info_etc
  var form = {
    select: 'ups_info_no, ups_no, ups_nm'
  };
  let upsInfoEtc = await db.fetch('ups_info_etc', form);
  let upsNo2ProductNo = {};
  upsInfoEtc.map(function (arr) {
    let upsNo = arr.ups_info_no;
    upsNo2ProductNo[upsNo] = arr.ups_no;
  });

  // query table: ups_info
  var form = {
    select: 'no, sta, out_mny, out_dt, disc_mny, due_dt, due_inv_dt, b_upcd, inv_ratio',
    sta: 'in.(F,G,H,I)',
  };
  let upsInfo = await db.fetch('ups_info', form);
  let upsNo2Row = {};
  upsInfo.map(function (arr) {
    let upsNo = arr.no;
    upsNo2Row[upsNo] = arr;
  });

  let items = [];
  for (const i of upsInvInfo.keys()) {
    let upsNo = upsInvInfo[i]['ups_info_no'];
    if (upsNo2Row[upsNo]) {  // 대출 모집중
      let outDt = upsNo2Row[upsNo]['out_dt'];
      let dueDt = upsNo2Row[upsNo]['due_dt'];
      let outMny = upsNo2Row[upsNo]['out_mny'];
      let discMny = upsNo2Row[upsNo]['disc_mny'];
      let bizType = getBizType(upsNo2Row[upsNo]['b_upcd']);
      let status = upsNo2Row[upsNo]['sta'];
      let dueInvDt = upsNo2Row[upsNo]['due_inv_dt'];  // 상환 예정일 = 어음만기일 + 5 영업일
      let saveDt = upsInvInfo[i]['save_dt'];  // 투자 입력일
      let saveTm = upsInvInfo[i]['save_tm'];  // 투자 입력시간
      let investmentAmt = upsInvInfo[i]['trade_money'];

      // get loanPeriod
      let outDtObj = new Date(addDashDate(outDt));
      let dueDtObj = new Date(addDashDate(dueDt));
      let loanPeriod = (dueDtObj - outDtObj) / (1000 * 60 * 60 * 24);

      // get returnInterest
      let param = {
        tradeMoney: investmentAmt,
        outMny: outMny,
        outDate: outDt,
        loanPeriod: loanPeriod,
        discMny: discMny,
        feeRatio: upsInvInfo[i]['p_fee_rate'],
      }
      let returnInfo = getReturnInfoNoProCheck(param);
      let returnInterest = returnInfo.returnInterest;
      let fee = returnInfo.fee;
      let tax = returnInfo.tax;
      let realInvRatio = returnInterest / investmentAmt * (365 / loanPeriod) * 100;

      let item = {
        invested_no: upsInvInfo[i]['no'],  // 투자번호
        product_no: upsNo2ProductNo[upsNo],  // 상품번호
        name: `${bizType} ${upsNo2ProductNo[upsNo]}호`,  // 상품명
        invested_at: moment(saveDt + 'T' + saveTm).format(),  // 투자입력일 (timestamp)
        date: moment(outDt + 'T180000').format(),  // 투자시작일 (대출지급일, timestamp)
        published_rate: upsNo2Row[upsNo]['inv_ratio'],  // 상품수익률 (게시 수익률)
        profit_rate: parseFloat(realInvRatio.toFixed(3)),
        days: loanPeriod,  // 투자일수
        issue_date: moment(dueDt).format(),  // 만기일 (timestamp)
        return_date: moment(dueInvDt).format(),  // 상환예정일 (timestamp)
        status: status === 'F' ? 'funding' : 'funded',  // 상품상태
        invested: investmentAmt,  // 투자금액
        expected: investmentAmt + returnInterest + tax,  // 상환예정금액
        expected_fee: fee,
        expected_tax: tax,
        expected_net_profit: returnInterest
      };

      items.push(item);
    }
  }

  // console.log(items);
  return items;
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
  outDate = addDashDate(outDate);
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

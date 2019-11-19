
// load common module
const { get, post, sleep, getToday, getDate } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');


async function main({ memberNo, productNo }) {
  // async function main(data) {
  // memberNo = 57;
  // productNo = 1454;

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

  // query table: erp_contract_info
  var form = {
    select: 'ups_info_no, sta'
  };
  let erpContractInfo = await db.fetch('erp_contract_info', form);
  let upsNosDone = [];
  erpContractInfo.forEach(function (arr) {
    if (arr.sta === 'E') {
      upsNosDone.push(arr.ups_info_no);
    }
  });

  // query table: ups_info_etc
  var form = {
    select: 'inv_mny, ups_info_no',
    ups_no: 'eq.' + productNo,
  };
  let upsInfoEtc = await db.fetch('ups_info_etc', form);
  // validity check for product_no
  if (!upsInfoEtc.length) {
    let result = {
      error: {
        code: 404,
        message: 'product_no not found'
      }
    };
    return result;
  }

  let upsNo = upsInfoEtc[0].ups_info_no;
  let invMny = upsInfoEtc[0].inv_mny;

  // query table: ups_info
  var form = {
    select: 'no, out_mny, member_no, sta',
  };
  let upsInfo = await db.fetch('ups_info', form);
  let upsNo2Row = {};
  let customerNo;
  let outMny;
  upsInfo.forEach(function (arr) {
    upsNo2Row[arr.no] = arr;
    if (arr.no === upsNo) {
      customerNo = arr.member_no;
      outMny = arr.out_mny;
    }
  });

  // query table: ups_inv_info
  var form = {
    select: 'trade_money, ups_info_no',
    member_no: 'eq.' + memberNo,
  };
  let upsInvInfo = await db.fetch('ups_inv_info', form);
  let totalInvestAmt = 0;
  let totalCorpInvestAmt = 0;
  upsInvInfo.forEach(function (arr) {
    if (upsNosDone.includes(arr.ups_info_no)) {  // if 완제, move to next iteration
      return;
    }
    totalInvestAmt += arr.trade_money;
    let loanMemberNo = upsNo2Row[arr.ups_info_no]['member_no'];
    if (customerNo === loanMemberNo) {
      totalCorpInvestAmt += arr.trade_money;
    }
  });

  let param = investorType || memberType;
  let LimitAmt = getLimitAmt(param);
  let corpLimitAmt = getCorpLimitAmt(param);


  let corpRemainingLimitAmount = corpLimitAmt - totalCorpInvestAmt;  // 업체투자잔여한도금액
  let productRemainingInvestAmt = outMny - invMny;  // 상품모집잔여금액 
  let remainingLimitAmt = LimitAmt - totalInvestAmt;  // 잔여한도금액

  let allowedInvestAmt = Math.min(corpRemainingLimitAmount, productRemainingInvestAmt, remainingLimitAmt);

  let result = {
    corp_available_amount: corpRemainingLimitAmount,  // 업체투자잔여한도금액
    product_available_amount: allowedInvestAmt,  // 상품투자잔여한도금액
    product_remain_amount: upsNo2Row[upsNo]['sta'] === 'F' ? productRemainingInvestAmt : 0,  // 상품모집잔여금액
    remain_capacity: remainingLimitAmt  // 잔여한도금액
  };

  result.corp_available_amount = infinityToValue(result.corp_available_amount);
  result.product_available_amount = infinityToValue(result.product_available_amount);
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

function getCorpLimitAmt(memberType) {
  if (memberType === 'C') {  // investorType === 'C' || memberType === 'C'
    return Number.POSITIVE_INFINITY;
  } else if (memberType === 'A' || memberType === 'B' || memberType === 'D') {
    return 5000000;
  } else if (memberType === 'E') {
    return 20000000;
  } else {
    throw new Error('Illegal memberType value');
  }
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

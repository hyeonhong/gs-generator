
// load common module
const { get, post, sleep, getToday, getDate } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');


async function main(memberNo) {
  // memberNo = 57;

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

  // query table: erp_contract_info
  var form = {
    select: 'no, sta'
  };
  let erpContractInfo = await db.fetch('erp_contract_info', form);
  let erpNo2Sta = {};
  erpContractInfo.map(function (arr) {
    let erpNo = arr.no;
    erpNo2Sta[erpNo] = arr.sta;
  });

  // query table: erp_inv_info
  var form = {
    select: 'contract_info_no, no, trade_money',
    member_no: 'eq.' + memberNo,
  };
  let erpInvInfo = await db.fetch('erp_inv_info', form);
  let totalInvestAmt = 0;
  erpInvInfo.forEach(function (arr) {
    let erpNo = arr.contract_info_no;
    if (erpNo2Sta[erpNo] !== 'E') {
      totalInvestAmt += arr.trade_money;
    }
  });

  let param = investorType || memberType;
  let LimitAmt = getLimitAmt(param);

  let result = {
    member_no: memberNo,  // 회원번호
    deposit: invList[0].inv_tail_money,  // 예치금
    pending_investment: invList[0].inv_money,
    pending_withdrawal: invList[0].app_return_money,  // 출금진행중금액
    remain_capacity: LimitAmt - totalInvestAmt  // 잔여한도금액
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

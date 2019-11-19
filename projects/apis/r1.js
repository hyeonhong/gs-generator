
// load common module
const { get, post, sleep, getToday, getDate } = require('../../lib/common.js');

// load db module
const db = require('../../lib/db.js');

// load crypto module
const AES = require('../../lib/crypto_Kross.js');
const DB_KEY = AES.getKey('SOL');  // DB 키
const REPORT_KEY = AES.getKey('REPORT');  // report 키


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
  let DBName = (memberType === 'P') ? 'cus_priv' : 'cus_corp';

  // query table: cus_priv or cus_corp
  var form = {
    select: 'email',
    member_no: 'eq.' + memberNo
  };
  let cusPrivOrCorp = await db.fetch(DBName, form);
  let email = cusPrivOrCorp[0].email;

  // query table: cus_plat_info
  var form = {
    select: 'name, addr11, addr12, ph1, zip, bank_acc_num, bank_code',
    member_no: 'eq.' + memberNo
  };
  let cusPlatInfo = await db.fetchRaw('cus_plat_info', form);

  // query table: erp_virtual_account
  var form = {
    select: 'bank_code, bank_acc_num',
    member_no: 'eq.' + memberNo,
    acc_type: 'eq.' + 'I'  // 투자자: I, 대출자: E
  };
  let erpVirtualAccount = await db.fetch('erp_virtual_account', form);

  // decrypt sensitive info
  let name = AES.decrypt(cusPlatInfo[0].name, DB_KEY);
  let address_1 = cusPlatInfo[0].addr11;
  if (address_1) {  // decrypt only if there's a value
    address_1 = AES.decrypt(address_1, DB_KEY);
  }
  let address_2 = cusPlatInfo[0].addr12;
  if (address_2) {  // decrypt only if there's a value
    address_2 = AES.decrypt(address_2, DB_KEY);
  }
  let zipcode = cusPlatInfo[0].zip;
  let bankCode = cusPlatInfo[0].bank_code;
  let bankAccountNo = AES.decrypt(cusPlatInfo[0].bank_acc_num, DB_KEY);
  let phoneNo = AES.decrypt(cusPlatInfo[0].ph1, DB_KEY);
  let virtualBankCode = erpVirtualAccount[0].bank_code;
  let virtualBankAccountNo = erpVirtualAccount[0].bank_acc_num;

  let decrypted = {
    name: name,  // 회원명
    addr1: address_1,  // 기본주소
    addr2: address_2,  // 상세주소
    zip: zipcode,  // 우편번호
    email: email,  // 이메일
    bankcode: bankCode,  // 출금계좌은행코드
    account: bankAccountNo,  //출금계좌번호
    tel: phoneNo,  //전화번호
    vbankcode: virtualBankCode,  //가상계좌은행코드
    vaccount: virtualBankAccountNo  //가상계좌번호
  };

  // encrypt the following
  let encrypted = AES.encrypt(JSON.stringify(decrypted), REPORT_KEY);

  let result = {
    member_no: memberNo,
    encrypted: encrypted
  };

  // console.log(AES.decrypt(encrypted, REPORT_KEY));

  // console.log(result);
  return result;
}


module.exports = {
  main
}

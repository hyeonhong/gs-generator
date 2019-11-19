const router = require('express').Router();

// R-1
router.get('/api/member/:member_no/info', async function (req, res) {
  const { main } = require('../../projects/apis/r1.js');
  let memberNo = parseInt(req.params.member_no);
  let result = await main(memberNo);

  res.json(result);
});

// R-2
router.get('/api/member/:member_no/deposit', async function (req, res) {
  const { main } = require('../../projects/apis/r2.js');
  let memberNo = parseInt(req.params.member_no);
  let result = await main(memberNo);

  res.json(result);
});

// R-3
router.get('/api/product/:product_no/capacity/:member_no', async function (req, res) {
  const { main } = require('../../projects/apis/r3.js');
  let param = {
    memberNo: parseInt(req.params.member_no),
    productNo: parseInt(req.params.product_no)
  };
  let result = await main(param);

  res.json(result);
});

// R-4
router.get('/api/member/:member_no/stat', async function (req, res) {
  const { main } = require('../../projects/apis/r4.js');
  let memberNo = parseInt(req.params.member_no);
  let result = await main(memberNo);

  res.json(result);
});

// R-5
router.get('/api/member/:member_no/investing', async function (req, res, next) {
  const { main } = require('../../projects/apis/r5.js');
  let memberNo = parseInt(req.params.member_no);
  let items = await main(memberNo);

  res.locals.items = items;  // pass parameter to next() via res.locals
  next();
}, paginate);

// R-6
router.get('/api/member/:member_no/done', async function (req, res, next) {
  const { main } = require('../../projects/apis/r6.js');
  let memberNo = parseInt(req.params.member_no);
  let items = await main(memberNo);

  res.locals.items = items;  // pass parameter to next() via res.locals
  next();
}, paginate);

// R-7
router.get('/api/member/:member_no/invested', async function (req, res, next) {
  const { main } = require('../../projects/apis/r7.js');
  let memberNo = parseInt(req.params.member_no);
  let items = await main(memberNo);

  res.locals.items = items;  // pass parameter to next() via res.locals
  next();
}, paginate);

// R-8
router.get('/api/member/:member_no/invested/:product_no', async function (req, res) {
  const { main } = require('../../projects/apis/r8.js');
  let param = {
    memberNo: parseInt(req.params.member_no),
    productNo: parseInt(req.params.product_no)
  };
  let result = await main(param);

  res.json(result);
});

// R-9
router.get('/api/member/:member_no/preparing', async function (req, res, next) {
  const { main } = require('../../projects/apis/r9.js');
  let memberNo = parseInt(req.params.member_no);
  let items = await main(memberNo);

  res.locals.items = items;  // pass parameter to next() via res.locals
  next();
}, paginate);

// R-10
router.get('/api/member/:member_no/products', async function (req, res, next) {
  let upsNos = req.query.ups_info_no && JSON.parse(req.query.ups_info_no);
  if (!upsNos || !Array.isArray(upsNos)) {
    let result = {
      error: {
        code: 400,
        message: 'The parameter ups_info_no is missing or not an array.'
      }
    };
    res.json(result);
  }
  const { main } = require('../../projects/apis/r10.js');
  let param = {
    memberNo: parseInt(req.params.member_no),
    upsNos: upsNos
  };
  let items = await main(param);

  res.locals.items = items;  // pass parameter to next() via res.locals
  next();
}, paginate);

// R-11
router.get('/api/product/list', async function (req, res, next) {
  let upsNos = req.query.ups_info_no && JSON.parse(req.query.ups_info_no);
  if (!upsNos || !Array.isArray(upsNos)) {
    let result = {
      error: {
        code: 400,
        message: 'The parameter ups_info_no is missing or not an array.'
      }
    };
    res.json(result);
  }

  const { main } = require('../../projects/apis/r11.js');
  let items = await main(upsNos);

  res.locals.items = items;  // pass parameter to next() via res.locals
  next();
}, paginate);

// R-12
router.get('/api/product/:product_no/detail', async function (req, res) {
  const { main } = require('../../projects/apis/r12.js');
  let productNo = parseInt(req.params.product_no);
  let result = await main(productNo);

  res.json(result);
});

// R-13
router.get('/api/product/:product_no/returns', async function (req, res) {
  const { main } = require('../../projects/apis/r13.js');
  let productNo = parseInt(req.params.product_no);
  let result = await main(productNo);

  res.json(result);
});

// R-14
router.get('/api/product/:product_no/returns/:member_no', async function (req, res) {
  const { main } = require('../../projects/apis/r14.js');
  let param = {
    productNo: parseInt(req.params.product_no),
    memberNo: parseInt(req.params.member_no)
  };
  let result = await main(param);

  res.json(result);
});

// R-15
router.get('/api/member/:member_no/preparing/:product_no', async function (req, res) {
  const { main } = require('../../projects/apis/r15.js');
  let param = {
    productNo: parseInt(req.params.product_no),
    memberNo: parseInt(req.params.member_no),
    investmentAmt: req.query.amount ? parseInt(req.query.amount) : null,
  };
  let result = await main(param);

  res.json(result);
});

// R-16
router.get('/api/member/:member_no/rejected', async function (req, res, next) {
  const { main } = require('../../projects/apis/r16.js');
  let memberNo = parseInt(req.params.member_no);
  let items = await main(memberNo);

  res.locals.items = items;  // pass parameter to next() via res.locals
  next();
}, paginate);

// pagination callback
function paginate(req, res) {
  let queryForm = req.query;
  let pageNumber = queryForm.page;
  let itemPerPage = queryForm.per_page;
  let pageOrder = queryForm.order;

  if ((pageNumber && !itemPerPage) || (itemPerPage && !pageNumber)) {
    let result = {
      error: {
        code: 400,
        message: 'Either both page & per_page parameters must be provided or neither of them.'
      }
    };
    return res.json(result);
  }
  if (itemPerPage) {
    if (isNaN(parseInt(itemPerPage)) ||
      isNaN(parseInt(pageNumber)) ||
      itemPerPage <= 0 ||
      pageNumber <= 0
    ) {
      let result = {
        error: {
          code: 400,
          message: 'Both page & per_page parameters must be integers.'
        }
      };
      return res.json(result);
    }
    itemPerPage = parseInt(itemPerPage);
    pageNumber = parseInt(pageNumber);
  }
  let items = res.locals.items;

  items = orderItems(pageNumber, itemPerPage, pageOrder, items);

  let result = { items: items };
  res.json(result);
}

function orderItems(pageNumber, itemPerPage, pageOrder, items) {
  let orderTable = {
    'investment_time': 'invested_at',
    'investment_amount': 'invested'
  };
  ifBlock:
  if (pageOrder) {
    let orderBy = pageOrder.split('.')[0];
    let orderProp = orderTable[orderBy];
    if (!orderProp) {  // if undefined
      break ifBlock;
    }
    let ascOrDesc = pageOrder.split('.')[1];

    // sort by order of orderProp
    if (ascOrDesc === 'desc') {
      items.sort(function (a, b) {
        if (typeof b[orderProp] === 'string') {
          return b[orderProp].localeCompare(a[orderProp]);
        } else {
          return b[orderProp] - a[orderProp];
        }
      });
    } else {
      items.sort(function (a, b) {
        if (typeof a[orderProp] === 'string') {
          return a[orderProp].localeCompare(b[orderProp]);
        } else {
          return a[orderProp] - b[orderProp];
        }
      });
    }
  }

  if (itemPerPage) {
    // implement pagination
    let numberOfPages = Math.ceil(items.length / itemPerPage);
    if (pageNumber > numberOfPages) {  // make sure: page number <= number of pages
      pageNumber = numberOfPages;
    }
    let startIndex = ((pageNumber - 1) * itemPerPage);
    let endIndex = startIndex + itemPerPage;

    return items.slice(startIndex, endIndex);
  } else {
    return items;
  }
}

module.exports = router;

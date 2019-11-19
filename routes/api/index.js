const router = require('express').Router();

router.use('/', require('./root.js'));
router.use('/', require('./report.js'));
// router.use('/report', require('./report.js'));

// router.use(function (err, req, res, next) {
//   if (err) {
//     return res.status(res.status).json({
//       error: err.message
//     });
//   }

//   return next(err);
// });

module.exports = router;

const router = require('express').Router();

router.use('/', require('./api'));

// process error
router.use(function (err, req, res, next) {
  res.status(422).json({ error: err.stack });
});

module.exports = router;

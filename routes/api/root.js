const router = require('express').Router();
const fs = require('fs');
const path = require('path');

// load common module
const { wrapAsync } = require('../../lib/common.js');

router.get('/', function(req, res) {
  console.log(`GET request to the path '/' has been made`);

  // res.send("success");
  res.send('Welcome to Report Server: ' + process.env.GS_ENV);
});

router.post(
  '/',
  wrapAsync(async function(req, res) {
    console.log(`POST request to the path '/' has been made`);
    /**
     *
     * request body (JSON)
     * {
     *    token: '',  // required
     *    projectName: '',  // data to be retrieved from, must be unique
     *    data: {}  // optional
     * }
     *
     */

    const parsedBody = req.body;

    // Check validity of parsed body
    if (typeof parsedBody.token !== 'string' || typeof parsedBody.projectName !== 'string') {
      return res.json({ error: `Invalid data type or JSON format` });
    }

    // Verify token
    const token = process.env.TOKEN;
    if (parsedBody.token !== token) {
      res.json({ error: 'Invalid token value' });
    }

    // Retrieve the relavant data from the specified file
    const projectName = parsedBody.projectName;
    const filePath = path.join(__dirname, `../../projects/${projectName}.js`);
    // Check if file exists, if not send error
    if (!fs.existsSync(filePath)) {
      return res.json({ error: `File '${projectName}.js' could not be found.` });
    }

    console.log(`${projectName} project starts executing...`);
    const { main } = require(filePath);
    let result;
    if (typeof parsedBody.data !== 'undefined') {
      result = await main(parsedBody.data);
    } else {
      result = await main();
    }

    if (result !== null && typeof result !== 'undefined' && typeof result === 'object') {
      return res.json(result);
    } else {
      return res.json({ error: `Have not received the Google API's response object.` });
    }
  })
);

// // POST method route
// router.post('/test', function (req, res) {
//   // Retrieve the POST data
//   let json = req.body;
//   let name = req.body.name,
//     color = req.body.color;

//   res.send('POST messagess');
// });

module.exports = router;

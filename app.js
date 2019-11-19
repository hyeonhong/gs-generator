// Set environment variable
require('dotenv').config();

const express = require('express');
const favicon = require('serve-favicon');
const morgan = require('morgan');
const logger = require('./logger');

global.rootDir = __dirname;  // Save the root directory

const PORT = process.env.PORT || '2004';


// morgan settings
logger.stream = {
  write: function (message, encoding) {
    logger.info(message.slice(0, -1));
  }
};
let morganFormat = `:method :url :status :res[content-length] Bytes - :response-time ms`;


const app = express()
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .use(favicon(__dirname + '/favicon.ico'))
  .use(morgan(morganFormat, { stream: logger.stream }))
  .use(require('./routes'));


app.listen(PORT, () => {
  logger.info('GS Generator app has started');
});

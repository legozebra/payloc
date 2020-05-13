'use strict';

const config = require('../config.json');
const render = require('./render.js');
const logger = require('./logger.js');

module.exports = (req, res, next) => {
  res.error = (error, status = 500) => {
    const err = new Error(error);
    err.status = status;

    let message = err.message;

    if (req.session.printCorrelationID) {
      message = message + ' Correlation ID: ' + res.correlationID
    }
    return res.json({
      error: true,
      success: false,
      message: message,
      status: err.status,
      stack: (config.dev) ? err.stack : undefined,
      correlationID: res.correlationID
    })
  },

  res.errorUI = (error, status = 500) => {
    const err = new Error(error)
    err.status = status
    return res.messageBox('Error', err.message, 'error')
  }

  res.messageBox = (title, message, style = "success", location = "/") => { //Quick sweetalert generator for frontend
    render.page(req, res, 'messageBox.html', 'messageBox', 'Alert', {
      title: title,
      message: message,
      style: style,
      location: location
    })
  }

  return next()
}

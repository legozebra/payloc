'use strict'

const config = require('../config.json')

module.exports = (req, res, next) => {
  res.error = (error, status = 500) => {
    const err = new Error(error)
    err.status = status
    return res.json({
      error: true,
      message: err.message,
      status: err.status,
      stack: (config.dev) ? err.stack : null
    })
  },

  res.errorUI = (error, status = 500) => {
    const err = new Error(error)
    err.status = status
    return res.render('pages/error.html', {
      errorMessage: err.message,
      pageTitle: 'Error',
      moduleID: 'login'
    })
  }

  return next()
}

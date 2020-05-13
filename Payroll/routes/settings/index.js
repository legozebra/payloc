const express = require('express'),
  router = express.Router(),
  config = require('../../config.json'),
  sessAuth = require('../../helpers/sessAuth'),
  render = require('../../helpers/render'),
  ChatModel = require('../../models/Chat');

router.all('*', sessAuth.verifyLoginRedirect, (req, res, next) => {
  next();
});

router.use('/attendance', sessAuth.verifyManagerLoginRedirect, require('./attendanceSettings'));
router.use('/users', sessAuth.verifyManagerLoginRedirect, require('./users'));
router.use('/advanced', sessAuth.verifyManagerLoginRedirect, require('./advancedSettings'));

/**
 * Payroll stuff
 */

router.all('*', sessAuth.verifyPayroll, (req, res, next) => {
  next();
});

router.use('/payroll/org', require('../payroll/config'));
router.use('/payroll', sessAuth.verifyManagerLoginRedirect, require('./payrollSettings'));

module.exports = router;
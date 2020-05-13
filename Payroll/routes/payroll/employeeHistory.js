// Payroll history, but for employees

const express = require('express'),
  router = express.Router(),
  OrgPayout = require('../../models/OrgPayout.js'),
  PayRecord = require('../../models/PayRecord.js'),
  config = require('../../config.json'),
  mongoose = require('mongoose'),
  moment = require('moment'),
  uuidv4 = require('uuid/v4'),
  _ = require('lodash'),
  sessAuth = require('../../helpers/sessAuth'),
  logger = require('../../helpers/logger'),
  render = require('../../helpers/render'),
  Lob = require('lob')(config.lobKey),
  LobProd = require('lob')(config.lobProdKey),
  stripe = require("stripe")(config.stripeSk),
  request = require('request'),
  fs = require('fs'),
  { forEach } = require('p-iteration');

router.get('/', sessAuth.verifyLoginRedirect, (req, res, next) => {
  render.page(req, res, 'payroll/payrollHistory.html', 'employeePayrollHistory', 'My Payroll History', {})
});

// Generate a table containing payroll history
router.get('/table', sessAuth.verifyLoginRedirect, async (req, res, next) => {
  const orgId = req.session.auth.org._id;
  const records = await PayRecord.find({
    orgId: orgId,
    employeeId: mongoose.Types.ObjectId(req.session.auth.user._id)
  }).populate('employeeId').lean().exec();

  let table = [];
  await forEach(records, (payRecord) => {
    let method = 'Direct Deposit';
    if (payRecord.type === 'lob')
      method = 'Paper Check';
    const payDisplay = {
      date: moment(payRecord.date).format('MMM Do YYYY'),
      employeeName: payRecord.employeeId.name,
      amount: '$' + payRecord.amount,
      paymentMethod: method,
      details: '<a href="/payroll/employee/' + payRecord.payId + '/">Details</a>'
    };
    table.push(payDisplay)
  });
  res.json({
    success: true,
    table: table
  })
});

// This route should be at the bottom
// Get a specific payment record
router.get('/:payId', sessAuth.verifyLoginRedirect, async (req, res, next) => {
  const orgId = req.session.auth.org._id;
  const record = await PayRecord.findOne({
    orgId: orgId,
    payId: req.params.payId,
    employeeId: mongoose.Types.ObjectId(req.session.auth.user._id)
  }).populate('employeeId items items.shiftId items.clockId').lean().exec();
  if (!record) {
    return res.errorUI('Record not found', 404);
  }
  record.humanDate = moment(record.date).format('MMM Do YYYY HH:MM:ss');
  let method = 'Direct Deposit';
  if (record.type === 'lob')
    method = 'Paper Check';
  record.method = method;
  record.getCheckUrl = '/payroll/history/' + record.payId + '/check/';
  render.page(req, res, 'payroll/employeePayRecord.html', 'employeePayRecord', 'Payment Record', record)
});

router.get('/:payId/table', sessAuth.verifyLoginRedirect, async (req, res, next) => {
  const orgId = req.session.auth.org._id;
  const record = await PayRecord.findOne({
    orgId: orgId,
    payId: req.params.payId,
    employeeId: mongoose.Types.ObjectId(req.session.auth.user._id)
  }).populate('employeeId').lean().exec();
  if (!record) {
    return res.error('Record not found', 404);
  }
  res.json({
    success: true,
    table: record.items
  })
});

module.exports = router;
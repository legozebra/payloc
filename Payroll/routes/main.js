const express = require('express'),
      router = express.Router(),
      Settings = require('../models/Settings.js'),
      UserPayout = require('../models/UserPayout.js'),
      logger = require('../helpers/logger'),
      error = require('../helpers/error'),
      sessAuth = require('../helpers/sessAuth');

router.get('/', sessAuth.verifyLoginRedirect, (req, res, next) => {
  UserPayout.findOne({
    orgId: req.session.auth.org._id,
    user: req.session.auth.user._id
  }, (err, result) => {
    if (!result && req.session.auth.premiumProduct) {
      // res.redirect('/settings/payroll')
    } else {
    }
      res.redirect('/scheduler')
  })

});

router.get('/correlate', (req, res, next) => {
  // Let all JSON output include correlateID
  req.session.printCorrelationID = true;
  if (!req.session.auth || !req.session.auth.user) {
    return res.redirect('/?cid=true');
  }
  return res.messageBox('Troubleshooting Mode Enabled', 'Troubleshooting mode has been enabled. You will receive a correlation ID along with error message whenever the system encounters an error. Please report the correlation ID to PayLoc support for further guidance');
});

router.get('/logout', (req, res, next) => {
  req.session.destroy();
  res.redirect('/')
});

module.exports = router;

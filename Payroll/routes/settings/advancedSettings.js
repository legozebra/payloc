const express = require('express'),
      router = express.Router(),
      config = require('../../config.json'),
      Settings = require('../../models/Settings.js'),
      UserPayout = require('../../models/UserPayout.js'),
      User = require('../../models/User.js'),
      sessAuth = require('../../helpers/sessAuth'),
      validator = require('validator'),
      Lob = require('lob')(config.lobKey),
      LobProd = require('lob')(config.lobProdKey),
      uuidv4 = require('uuid/v4'),
      randomstring = require('randomstring'),
      stripe = require("stripe")(config.stripeSk),
      render = require('../../helpers/render'),
      request = require('request'),
      escape = require('escape-html');

router.get('/', sessAuth.verifyManagerLoginRedirect, async (req, res, next) => {
  const settings = await Settings.findOne({orgId: req.session.auth.org._id}).lean().exec();
  render.page(req, res, 'advancedSettings.html', 'advancedSettings', 'Advanced Settings', {
    TestMode: settings.testmode ? ' checked' : '',
    oneAddressMode: settings.oneAddressMode ? ' checked' : '',
  });
});

router.post('/', sessAuth.verifyManagerLoginRedirect, async (req, res, next) => {
  const settings = await Settings.findOne({orgId: req.session.auth.org._id}).exec();
  settings.testmode = req.body.testMode;
  settings.oneAddressMode = req.body.oneAddressMode;
  await settings.save();
  res.json({
    success: true
  })
});


module.exports = router

const express = require('express'),
  router = express.Router(),
  error = require('../helpers/error.js'),
  config = require('../config.json'),
  User = require('../models/User'),
  crypto = require('crypto'),
  App = require('../models/App'),
  Organization = require('../models/Organization'),
  Ticket = require('../models/Ticket'),
  randomstring = require("randomstring"),
  uuidv4 = require('uuid/v4'),
  validator = require('validator'),
  sessAuth = require('../helpers/sessAuth'),
  subscription = require('../helpers/subscription'),
  stripe = require("stripe")(config.stripe.stripeSk),
  csurf = require("csurf"),
  Recaptcha = require("Recaptcha").Recaptcha;

router.get('/', csurf(), (req, res, next) => {
  res.render('pages/forgotpwd_start.html', {
    pageTitle: 'Forgot Password - PayLoc',
    moduleID: 'forgotpwd_start',
    csrf: req.csrfToken()
  });
});

router.post('/initiate', csurf(), (req, res, next) => {

});

module.exports = router;
const express = require('express'),
  router = express.Router(),
  error = require('../helpers/error.js')
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
  stripe = require("stripe")(config.stripe.stripeSk)

router.get('/support', verifyLoginRedirect, (req, res, next) => {
  res.redirect(getFreshDeskUrl(req.session.authApp.user.name, req.session.authApp.user.username, req.session.authApp.org.name, ''))
});

function getFreshDeskUrl(name, email, company, redirect_to) {
  const freshdesk_secret = 'f91446e8bf4e7710d1dcb9398a70c57e'; // Yeah this is hardcoded sorry lol - Chris
  const freshdesk_base_url = 'https://paylochelp.freshdesk.com';

  const timestamp = Math.floor(new Date().getTime() / 1000).toString();
  const hmac = crypto.createHmac('md5', freshdesk_secret);
  hmac.update(name + freshdesk_secret + email + timestamp);
  const hash = hmac.digest('hex');
  return freshdesk_base_url + '/login/sso/' +
    '?name=' + encodeURIComponent(name) +
    '&email=' + encodeURIComponent(email) +
    '&company=' + encodeURIComponent(company) +
    '&timestamp=' + encodeURIComponent(timestamp) +
    '&hash=' + encodeURIComponent(hash) +
    ( typeof(redirect_to) === 'string' ? '&redirect_to=' + encodeURIComponent(redirect_to) : '' );
}

function verifyLoginRedirect(req, res, next) {
  if (req.session.authApp == undefined || req.session.authApp.user == undefined) {
    sessAuth.loginToSupport(req, res, 'sso/support')
  } else {
    next()
  }
}

module.exports = router

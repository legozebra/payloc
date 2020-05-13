const express = require('express'),
      router = express.Router(),
      error = require('../helpers/error.js'),
      logger = require('../helpers/logger.js'),
      config = require('../config.json'),
      crypto = require('crypto'),
      request = require('request'),
      rp = require('request-promise'),
      Settings = require('../models/Settings'),
      sessAuth = require('../helpers/sessAuth.js');

router.get('/', (req, res, next) => {
  if(req.query.sts === null || req.query.version === null ) {
    //return res.errorUI('Invalid login request', 400)
    sessAuth.login(req, res)
  } else {
    if (req.session.auth === undefined) {
      req.session.auth = {}
    }
    if (req.session.auth.redirect === req.protocol + '://' + req.get('host') + '/login') {
      req.session.auth.redirect = '/'
    }
    request(config.auth.authEndpoint + '/api/ticket/' + req.query.sts.toString() + '/redeem', function (err, response, body) {
      if (err || response.statusCode === 500) {
        return res.errorUI('Unknown server error. Please try again later or contact PayLoc support. ', 500)
      }
      if (response.statusCode === 401) {
        if (req.session.auth == undefined || req.session.auth.redirect == undefined) {
          return res.redirect('/login')
        }
        return res.redirect(req.session.auth.redirect) //login failed - let the user re-login
      }
      const ticket = JSON.parse(body);
      req.session.auth.user = ticket.entitlement;
      req.session.auth.ticket = req.query.sts.toString();
      Settings.findOne({orgId: ticket.entitlement.authorizedOrgs}, (err, result) => {
        req.session.orgSettings = result;
      });
      const promises = [
        rp({json: true, uri: config.auth.authEndpoint + '/api/ticket/' + ticket.ticket + '/orgInfo/' + config.baseProductId}),
        rp({json: true, uri: config.auth.authEndpoint + '/api/ticket/' + ticket.ticket + '/checkProduct/' + config.premiumProductId})
      ];
        Promise.all(promises).then((body) => {
          req.session.auth.org = body[0];
          req.session.auth.loggedIn = true;
          req.session.auth.subscription = body[0].subscription;
          req.session.auth.baseProduct = true;
          req.session.auth.premiumProduct = body[1].success;
          if (req.session.auth.subscription === false) {
            req.session.auth.subscription = {}
          }
          if (req.session.auth === undefined || req.session.auth.redirect === undefined) {
            return res.redirect('/');
          }
          logger.info({
            req: req,
            user: ticket.entitlement.username,
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
          }, 'User logged in');
          return res.redirect(req.session.auth.redirect)
        }).catch((err) => {
          logger.error({
            req: req,
            err: err
          }, 'Error when requesting productSDK authorization through auth. something might went wrong on the auth side or stripe side. ');
          return res.errorUI('Unknown server error. Please try again later or contact PayLoc support. ', 500)
        })
    });
  }
})

router.get('/logout', (req, res, next) => {
  req.session.auth = {}
  res.redirect('/login')
  return;
})

function generateHMAC(message, passInSecret) {
  const hmac = crypto.createHmac('sha256', passInSecret.toString());
  hmac.update(message.toString());
  return hmac.digest('hex')
}

module.exports = router

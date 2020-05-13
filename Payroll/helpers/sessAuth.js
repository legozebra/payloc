const error   = require('../helpers/error'),
      config  = require('../config.json'),
      randomstring = require('randomstring'),
     request = require('request'),
      uuidv4 = require('uuid/v4'),
      Settings = require('../models/Settings'),
      logger = require('./logger'),
      crypto = require('crypto');

const sessAuth = {
  verifyLogin: (req, res, next) => {
    if (req.session.auth && req.session.auth.loggedIn) {
      next()
    } else {
      res.jsonError('Authentication Required', 401)
    }
  },
  verifyLoginRedirect: (req, res, next) => {
    if (req.session.auth && req.session.auth.loggedIn) {
      next()
    } else {
      sessAuth.login(req, res)
    }
  },
  verifyManagerLoginRedirect: (req, res, next) => {
    if (req.session.auth && req.session.auth.loggedIn && req.session.auth.user.accessLevel < 1) {
      next()
    } else {
      sessAuth.login(req, res)
    }
  },
  verifyPayroll: (req, res, next) => {
    if (!req.session.auth.premiumProduct) {
      logger.info({
        req: req
      }, 'Access denied to Payroll product because the subscription doesn\'t have a premium SDK');
      global.IntercomClient.events.create({
        event_name: 'access-denied-payroll',
        created_at: Math.round((new Date()).getTime() / 1000),
        user_id: req.session.auth.user._id
      });
      return res.errorUI('This feature is in alpha stage now. If you are interested, drop us a line at hello@payloc.io', 402);
    }
    next();
  },
  isManager: (req) => {
    return req.session.auth.user.accessLevel < 1;
  },
  login: (req, res) => {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const nonce = uuidv4();
    const redirectURL = req.protocol + '://' + req.get('host') + '/login';
    if (req.session.auth === undefined) {
      req.session.auth = {}
    }
    if (req.originalUrl !== '/login'){
      req.session.auth.redirect = fullUrl
    }
    req.session.save();
    // console.log(req.session.auth.redirect);
    const HMAC = generateHMAC(redirectURL + nonce, config.auth.appSecret);
    res.redirect(config.auth.authEndpoint + "/login/?appID=" + config.auth.appID + "&nonce=" + nonce + "&redirect=" + redirectURL + "&signature=" + HMAC)
  },
  ticket: (req, res, next) => {
    if (req.token === undefined) {
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Bearer realm="PayLoc API - Please supply your access token. "');
      res.end('Access denied');
      return;
    }
    const ticket = req.token;
    request(config.auth.authEndpoint + '/api/ticket/' + ticket + '/userInfo', function (err, response, userBody) {
      const user = JSON.parse(userBody);
      if (response.statusCode !== 200 || user.error === true) {
        return res.error(user.message, response.statusCode);
      }
      request(config.auth.authEndpoint + '/api/ticket/' + ticket + '/orgInfo', function (err, response, orgJSON) {
        const org = JSON.parse(orgJSON);
        if (response.statusCode !== 200 || org.error === true) {
          return res.error(org.message, response.statusCode);
        }
        req.payloc = {};
        req.payloc.user = user;
        req.payloc.org = org;
        Settings.findOne({orgId: req.payloc.org._id}, (err, result) => {
          if (err) {
              return res.error('An server error occurred. Please try again later. ', 500);
          }
          req.payloc.settings = result;
          next()
        });

      })
    })
  }
}

function generateHMAC(message, passInSecret) {
  const hmac = crypto.createHmac('sha256', passInSecret.toString());
  hmac.update(message.toString());
  return hmac.digest('hex')
}


module.exports = sessAuth;
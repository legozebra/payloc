const express = require('express'),
      router = express.Router(),
      error = require('../helpers/error.js'),
      subscription = require('../helpers/subscription.js')
      config = require('../config.json'),
      User = require('../models/User'),
      crypto = require('crypto'),
      bcrypt = require('bcryptjs'),
      App = require('../models/App'),
      Organization = require('../models/Organization'),
      Ticket = require('../models/Ticket'),
      randomstring = require("randomstring"),
      uuidv4 = require('uuid/v4')

router.post('/', (req, res, next) => {
  const errorMessage = 'Your username or password is incorrect'
  if (req.body.username === '' || req.body.password === '') {
    return res.error('Please enter your username and password', 400)
  }
  if (req.session.authApp == undefined || req.session.authApp === null) {
    return res.error('Please start over from the source application')
  }
  const paylocEmail = new RegExp('@?payloc.io');
  const username = req.body.username.trim();
  const password = req.body.password;
  var loginAttachment = '';
  if (paylocEmail.test(username)){
    // using payloc email
    const aadHeader = req.header('X-MS-CLIENT-PRINCIPAL-NAME');
    if (!config.dev && (aadHeader === undefined || aadHeader === null)){
      // not authed
      // return res.error('Access denied due to corporate signin policy. See https://payloc.sharepoint.com/sites/CRM/SitePages/How%20to%20log%20into%20PayLoc%20Debug%20Environment.aspx', 401);
    } else {
      // loginAttachment = loginAttachment + ' PLCorpAcct';
    }
  }
  User.findOne({username: username.toString().toLowerCase()}, (err, user) => {
    if(err || user == null) {
      return res.error(errorMessage, 401)
    }
    bcrypt.compare(password, user.password, function(err, response) {
      if (err) {
        return res.error('Something went wrong. Please try again.', 500)
      }
      if (response === false) {
        return res.error(errorMessage, 401)
      }
      req.session.authApp.username = username;
      req.session.authApp.user = user;

      delete user.password;
      user.password = '';

      if (user.changePasswordEnforced) {
        req.session.authApp.passwordChangeAuthorized = true;
        return res.json(
        {
          redirect: ('changepassword'),
          name: user.name
        })
      }

      Organization.findOne({_id: user.authorizedOrgs}, (err, org) => {
        if (err || !org || org.disabled) {
          return res.error('Your organization is disabled. Please contact your administrator for assistance.', 401)
        }
        if (org.billingCustomerId === '' || org.billingCustomerId === undefined) {
          return res.error('Your organization does not have a valid billing account. Please contact PayLoc support for assistance. ', 401)
        }
        req.session.authApp.org = org
        try {
          subscription.checkProduct(org.billingCustomerId, req.session.authApp.app.productId).then((result) => {
            if (result === false) {
              return res.error('Your organization is not subscribed to this product. Please contact your PayLoc sales representative for more information. ', 500)
            }
            const ticket = uuidv4();
            const authHMAC = generateHMAC(user.name & user.username & user.authorizedOrgs, req.session.authApp.app.appSecret);
            const expirationTimestamp = Math.floor(Date.now() / 1000) + config.ticketExpiration;
            user.toObject();
            delete user.password;
            Ticket.create({
              ticket: ticket,
              entitlement: user,
              expiration: expirationTimestamp,
              signature: authHMAC,
              redeemed: false
            }, (err) => {
              if (err) {
                res.error('Temporary server error. Please try again. If you keep getting this error, please contact PayLoc.', 503)
              }
              const attachmentStr = "?sts=" + ticket.toString() + "&version=1.0"

              if(req.session.authApp.redirect !== null) {
                res.json(
                  {
                    redirect: (req.session.authApp.redirect + attachmentStr).toString(),
                    name: user.name + loginAttachment
                  })
              } else {
                res.json(
                  {
                    redirect: ('https://scheduler.payloc.io' + attachmentStr).toString(),
                    name: user.name + loginAttachment
                  })
              }
              return;
            })
          })
        } catch (e) {
          return res.error('Something went wrong. Please try again.', 500)
        }
      });
    });

  })
})

router.get('/', (req, res, next) => {
  if(req.query.appID == null || req.query.redirect == null || req.query.nonce == null || req.query.signature == null) {
    return res.error('Please start over from your source application', 400)
  } else {

    App.findOne({appID: req.query.appID}, (err, appResult) => {

      if (err || appResult === null) {
        return res.errorUI('Could not find a valid source application.', 403)
      }
      //console.log(req.query.redirect + req.query.nonce)
      //console.log(appResult.appSecret)
      //console.log(generateHMAC(req.query.redirect + req.query.nonce, appResult.appSecret) )
      if (generateHMAC(req.query.redirect + req.query.nonce, appResult.appSecret) !== req.query.signature) {
        return res.error('Invalid signature', 403)
      }
      const appID = req.query.appID
      req.session.authApp = {}
      req.session.authApp.app = appResult
      req.session.authApp.redirect = decodeURIComponent(req.query.redirect)
      //console.log(req.session.authApp.redirect)
      //render the login page
      res.render('pages/login.html', {
        appDescription: appResult.appDescription,
        pageTitle: 'Sign In - PayLoc',
        moduleID: 'login'
      })
    })
  }
})

router.get('/changepassword', (req, res, next) => {
  if(!req.session.authApp || !req.session.authApp.passwordChangeAuthorized) {
    return res.redirect('https://scheduler.payloc.io/', 401);
  }
  res.render('pages/changepassword.html', {
    pageTitle: 'Change Password - PayLoc',
    moduleID: 'changepwd'
  })
})

router.post('/changepassword', (req, res, next) => {
  if(!req.session.authApp.passwordChangeAuthorized) {
    return res.error('Your session has expired. Please try again.', 401);
  }
  if (req.body.newpassword === ''){
    return res.error('Please enter a new password', 400);
  }
  User.findOne({_id: req.session.authApp.user._id}, (err, user) => {
    bcrypt.genSalt(10, function(err, salt) {
      bcrypt.hash(req.body.newpassword, salt, function(err, hash) {
        //console.log(user)
        req.session.authApp.passwordChangeAuthorized = false
        user.password = hash
        user.changePasswordEnforced = false
        user.save((err) => {
          if (err) {
            return res.error('An internal error occurred.', 500);
          }
          req.session.destroy()
          return res.json({
            success: true
          })
        })
      })
    })
  })
})

router.post('/deviceToken', (req, res, next) => {
  const errorMessage = 'Your username or password is incorrect'
  if (req.body.username === '' || req.body.password === '') {
    return res.error('Please enter your username and password.', 400);
  }

  const username = req.body.username
  const password = req.body.password

  User.findOne({username: username.toString().toLowerCase()}, (err, user) => {
    if(err || user == null) {
      console.log(err)
      console.log(user);
      console.log(username);
      return res.error(errorMessage, 401)
    }
    bcrypt.compare(password, user.password, function(err, response) {
      if (err) {
        return res.error('An internal error occurred.', 500);
      }
      if (response === false) {
        return res.error(errorMessage, 500);
      }
      const ticket = uuidv4();
      const expirationTimestamp = Math.floor(Date.now() / 1000) + config.ticketExpiration;
      user.toObject()
      delete user.password;
      Ticket.create({
        ticket: ticket,
        entitlement: user,
        expiration: expirationTimestamp,
        redeemed: false
      }, (err) => {
        if (err) {
          return res.error('An internal error occurred.', 500);
        }
        res.json({
          success: true,
          ticket: ticket
        })
      })
    })
  })
})

router.get('/logout', (req, res, next) => {
  req.session.destroy();
  res.redirect('https://payloc.io')
  return;
})

function generateHMAC(message, passInSecret) {
  const hmac = crypto.createHmac('sha256', passInSecret.toString());
  hmac.update(message.toString());
  return hmac.digest('hex')
}

module.exports = router

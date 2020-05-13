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

router.get('/', sessAuth.verifyLoginRedirect, (req, res, next) => {
  UserPayout.findOne({
    orgId: req.session.auth.org._id,
    user: req.session.auth.user._id
  }, (err, result) => {
    //console.log(result);
    if (result == null) {
      console.log('null payoutMethod');
      result = {}
      result.addressObj = {}
    }
    if (req.session.stripeState === undefined) {
      req.session.stripeState = randomstring.generate()
    }
    if (result.addressObj === undefined) {
      result.addressObj = {}
    }

      const renderData = {
          payout: result.addressObj,
          payoutMethod: result.preferredPayoutMethod,
          user: req.session.auth.user,
          stripeClientId: config.stripeClientId,
          state: req.session.stripeState,
          stripeRedirect: req.protocol + '://' + req.get('host') + '/settings/stripeRedirect',
          org: req.session.auth.org
      };
      //console.log(result.preferredPayoutMethod);
      if (result.preferredPayoutMethod === 'stripe') {
          stripe.accounts.retrieve(
              result.stripeAccountId,
              (err, account) =>  {
                  if (err) {
                      render.page(req, res, 'settings.html', 'settings', 'Settings', renderData)
                      return
                  }
                  //console.log(account);
                  renderData.stripeExternalLoginEnabled = true
                  render.page(req, res, 'settings.html', 'settings', 'Settings', renderData)

              }
          );
      } else {
          render.page(req, res, 'settings.html', 'settings', 'Settings', renderData)
      }
    //console.log(render);
  })
})

router.post('/address', sessAuth.verifyLoginRedirect, (req, res, next) => {
  //weird variable names used on purpose so people couldn't google the name of our provider hehe
  const addrIntId = uuidv4();
    LobProd.usVerifications.verify({
      primary_line: req.body.first,
      secondary_line: req.body.second,
      zip_code: req.body.fourCode
    }, function (err, addrVerified) {
      //console.log (err, res);
      if (err) {
        return res.error('You have entered an invalid address. Please double check your address.', 400);
      }
      switch(addrVerified.deliverability) {
        case "deliverable":
          //good! do nothing
          break;
        case "deliverable_extra_secondary":
          return res.error('Please double check your secondary address line. It might be extra in this case. Try removing it to ensure delivery. ', 400);
          break;
        case "deliverable_missing_secondary":
          return res.error('It appears that you need a secondary address line for accurate delivery. Did you forget your room number?', 400);
          break;
        case "undeliverable":
          return res.error('Your address is not served by USPS. Please ask your administrator to contact PayLoc support for alternative options.', 400);
          break;
        case "no_match":
          return res.error('We could not find your address in USPS database. Please double check your spelling.', 400);
          break;
        default:
          return res.error('An internal error occurred.', 500);
      }
      console.log(addrVerified.components.zip_code + '' + addrVerified.components.zip_code_plus_4);
      Lob.addresses.create({
        description: req.session.auth.org.name + '-' + req.session.auth.user.name,
        name: req.session.auth.user.name,
        email: req.session.auth.user.username,
        address_line1: addrVerified.primary_line,
        address_line2: addrVerified.secondary_line,
        address_city: addrVerified.components.city,
        address_state: addrVerified.components.state,
        address_zip: addrVerified.components.zip_code + '-' + addrVerified.components.zip_code_plus_4,
        address_country: 'US',
        metadata: {
          orgId: req.session.auth.org._id.toString(),
          type: 'UserPayout',
          employeeId: req.session.auth.user._id.toString(),
          addrIntId: addrIntId
        }
      },  (err, addr) => {
        if (err) {
          return res.error('An internal error occurred.', 500);
        }
        UserPayout.remove({
          orgId: req.session.auth.org._id,
          user: req.session.auth.user._id
        }, () => {
          UserPayout.create({
            orgId: req.session.auth.org._id,
            user: req.session.auth.user._id,
            addrIntId: addrIntId,
            addressObj: addr,
            preferredPayoutMethod: 'check'
          }, (err) => {
            if (err) {
              console.log(err);
              return res.error('An internal error occurred.', 500);
            }
            return res.json({
              success: true
            })
          })
        })
      });
    });
});

router.get('/stripeRedirect', sessAuth.verifyLoginRedirect, (req, res, next) => {
  const code = req.query.code
  const state = req.query.state
  if (code === undefined || state === undefined) {
    return res.errorUI('An internal error occurred.', 500);
  }
  if (!config.dev && state !== req.session.stripeState) {
    return res.errorUI('An internal error occurred.', 500);
  }
  request.post('https://connect.stripe.com/oauth/token', {
    form: {
      grant_type: 'authorization_code',
      client_id: config.stripeClientId,
      client_secret: config.stripeSk,
      code: code
    },
    json: true
  }, (err, response, body) => {
    if (err || body.error) {
      return res.errorUI('The direct deposit onboarding process has not succeeded.');
    } else {
      const stripeAccountId = body.stripe_user_id;

      UserPayout.remove({
        orgId: req.session.auth.org._id,
        user: req.session.auth.user._id
      }, () => {
        UserPayout.create({
          orgId: req.session.auth.org._id,
          user: req.session.auth.user._id,
          stripeAccountId: stripeAccountId,
          preferredPayoutMethod: 'stripe'
        }, (err) => {
          if (err) {
            console.log(err);
            return res.error('An internal error occurred.', 500);
          }
          res.messageBox('Direct Deposit Set Up', 'You have successfully set up direct deposit', 'success', '/')
        })
      })

    }
  });
})

router.get('/loginStripe', sessAuth.verifyLoginRedirect, (req, res, next) => {
  UserPayout.findOne({
    orgId: req.session.auth.org._id,
    user: req.session.auth.user._id
  }, (err, result) => {
    if (result.preferredPayoutMethod == 'stripe' && result.stripeAccountId !== '') {
      stripe.accounts.createLoginLink(result.stripeAccountId, function(err, account) {
        if (account === null) {
          res.messageBox('Error', 'The payment account associated with this PayLoc account cannot be accessed. Please contact PayLoc support through chat or email. We apologize for any inconvenience. ', 'error')
          return;
        }
        res.redirect(account.url)
      });
    } else {
      res.errorUI('You have not set up direct deposit yet. ', 400)
    }
  })
})

module.exports = router

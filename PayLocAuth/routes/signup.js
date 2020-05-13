const express = require('express'),
      router = express.Router(),
      error = require('../helpers/error.js'),
      config = require('../config.json'),
      User = require('../models/User'),
      Role = require('../models/Role'),
      Assignment = require('../models/Assignment'),
      crypto = require('crypto'),
      App = require('../models/App'),
      bcrypt = require('bcryptjs'),
      Organization = require('../models/Organization'),
      Ticket = require('../models/Ticket'),
      randomstring = require("randomstring"),
      validator = require('validator'),
      uuidv4 = require('uuid/v4'),
      stripe = require("stripe")(config.stripe.stripeSk);

router.post('/', (req, res, next) => {
  const sessID = uuidv4()
  if (req.body.username === '' || req.body.password === '' || req.body.name === '' || req.body.bizName === '' || req.body.phone === '') {
    return res.error('Please enter all fields', 400)
  }
  if (!(validator.isEmail(req.body.username.toString()))){
    return res.error('Please enter a valid email address.', 400)
  }
  const username = validator.normalizeEmail(req.body.username.toString()).toLowerCase().trim()
  const password = req.body.password
  const name = req.body.name.trim()
  const bizName = req.body.bizName.trim()
  const phone = req.body.phone.trim()
  User.findOne({username: username}, (err, user) => {
    if (user !== null) {
      return res.error('You are already registered in our system. You may retrieve your password on the login page. ', 400) //TODO: put a link to forgot password page
    }
    Organization.findOne({
      name: bizName,
      phone: phone
    }, (err, org) => {

      if (org !== null) {
        return res.error('Your business already exists on PayLoc. Please contact your PayLoc representative or email us at support@payloc.io', 400)
      }
      if (err) {
        console.log(sessID + ': findOrg error');
        return res.error('We encountered an error. Please try again or contact PayLoc support. Your reference ID: ' + sessID, 500);
      }
      bcrypt.genSalt(10, function(err, salt) {
          bcrypt.hash(password, salt, function(err, hash) {
            Organization.create({
              name: bizName,
              authorizedUsers: [''],
              timezone: req.body.tz
            }, (err, orgCreated) => {
              if (err) {
                console.log(sessID + ': unable to provision org');
                return res.error('We encountered an error. Please try again or contact PayLoc support. Your reference ID: ' + sessID, 500);
              }
              User.create({
                name: name,
                username: username,
                password: hash,
                authorizedOrgs: orgCreated._id,
                accessLevel: 0,
                phone: phone,
                creationChannel: 'Org Signup'
              }, (err, userCreated) => {
                if (err) {
                  orgCreated.delete()
                  console.log(sessID + ': unable to provision user');
                  return res.error('We encountered an error. Please contact PayLoc support at support@payloc.io. Your reference ID: ' + sessID, 500);
                }
                orgCreated.authorizedUsers = [userCreated._id]
                orgCreated.save((err) => {
                  if (err) {
                    console.log(sessID + ': unable to authorize user');
                    return res.error('We encountered an error. Please contact customer support at support@payloc.io. ', 500);
                  }
                  Role.create({
                    name: 'Company Administrator',
                    description: 'Full control over the company',
                    deletable: false,
                    organizationId: orgCreated._id,
                    permissionIds: ["*"]
                  }, (err, roleCreated) => {
                    if (err) {
                      console.log(sessID + ': unable to provision RBAC roles');
                      return res.error('We encountered an error. Please contact customer support at support@payloc.io. ', 500);
                    }
                    Assignment.create({
                      personId: userCreated._id,
                      roleId: roleCreated._id,
                      assignedBy: 'system'
                    }, (err, assignmentCreated) => {
                        if (err) {
                          console.log(sessID + ': unable to authorize user with RBAC');
                          return res.error('We encountered an error. Please contact customer support at support@payloc.io. ', 500);
                        }
                      req.session.authApp = {};
                      req.session.authApp.username = userCreated.username;
                      req.session.authApp.user = userCreated;
                      res.json({
                        result: 'success'
                      })
                    });
                  });
                });
              });
            });
          });
      });
    });
  });

})

router.get('/', (req, res, next) => {
  try {
    // console.log(config.sales.defaultProductID);
    subscription.getProduct(config.sales.defaultProductID).then((result) => {
      if (result === false) {
        console.log('DEFAULT PRODUCT NOT FOUND');
        throw 'DEFAULT PRODUCT NOT FOUND';
      }
      res.render('pages/signup.html', {
        pageTitle: 'Sign Up - PayLoc',
        moduleID: 'signup',
        product: result,
        stripeKey: config.stripe.stripePk,
        productName: result.name,
        quantity: config.sales.defaultQuantity
      })
    })
  } catch (e) {
    res.errorUI('An internal server error has occurred. ')
  }
});

router.get('/coupon/:cusId', async (req, res, next) => {
  if (req.params.cusId === '') {
    return res.error('Something went wrong. Please try again. ', 400);
  }
  const cusId = req.params.cusId;

  // Check if it is a coupon code
  try {
    const coupon = await stripe.coupons.retrieve(cusId).then();
    // Yes - coupon code
    if (!coupon.valid) {
      // Coupon cannot be applied at this moment
      return res.error('This coupon cannot be applied at this moment. ', 400);
    }
    // Set noCreditCard = yes in coupon metadata to bypass credit card
    return res.json({
      success: true,
      bypassStripe: (coupon.metadata.noCreditCard === "yes"),
      type: 0
    })
  } catch (e) {
    // Try Stripe customer ID
    try {
      const stripeCustomer = await stripe.customers.retrieve(cusId).then();
      if (!stripeCustomer) {
        return res.error('This coupon code is invalid. ', 404);
      }

      if (stripeCustomer.metadata.orgId !== undefined) {
        // Disconnected user account
        // admin need to delete orgId through stripe dashboard
        return res.error('This coupon code has already been redeemed. ', 401);
      }
    } catch (e) {
      return res.error('This coupon code is invalid. ', 404);
    }
    try {
      const orgLinkedWithCusId = await Organization.find({billingCustomerId: cusId}).lean().exec();
      if (orgLinkedWithCusId.length > 0) {
        return res.error('This coupon code has already been redeemed. ', 401);
      }
    } catch (e) {
      return res.error('Something went wrong. Please try again. ', 500);
    }
    return res.json({
      success: true,
      bypassStripe: true,
      type: 1
    })
  }

});
function generateHMAC(message, passInSecret) {
  const hmac = crypto.createHmac('sha256', passInSecret.toString());
  hmac.update(message);
  return hmac.digest('hex')
}

module.exports = router

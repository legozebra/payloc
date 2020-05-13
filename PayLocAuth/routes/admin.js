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
  randomWords = require('random-words'),
  uuidv4 = require('uuid/v4'),
  json2csv = require('json2csv'),
  bcrypt = require('bcryptjs'),
  validator = require('validator'),
  sessAuth = require('../helpers/sessAuth'),
  rp = require('request-promise'),
  csv = require('csvtojson'),
  subscription = require('../helpers/subscription'),
  twilio = require('twilio'),
  stripe = require("stripe")(config.stripe.stripeSk);

const accountSid = config.twilio.accountSid; // Your Account SID from www.twilio.com/console
const authToken = config.twilio.authToken;   // Your Auth Token from www.twilio.com/console
const twilioClient = new twilio(accountSid, authToken);

router.get('/', verifyLoginRedirect, (req, res, next) => {
  res.render('pages/users.html', {
    pageTitle: 'User Management - PayLoc',
    moduleID: 'um'
  })
});

// not ready yet!
router.get('/billing', verifyLoginRedirect, (req, res, next) => {
  res.end('')
  // res.render('pages/billing.html', {
  //   pageTitle: 'Billing - PayLoc',
  //   moduleID: 'billing'
  // })
});

router.get('/create', verifyLoginRedirect, (req, res, next) => {
  res.render('pages/createUser.html', {
    pageTitle: 'Create User - PayLoc',
    moduleID: 'um-create'
  })
});

router.get('/subscribe', verifyLoginRedirect, (req, res, next) => {
  // console.log(req.session)
  try {
    subscription.getProduct(config.sales.defaultProductID).then((result) => {
      if (result === false) {
        console.log('DEFAULT PRODUCT NOT FOUND');
        throw 'DEFAULT PRODUCT NOT FOUND';
      }
      res.render('pages/subscribe.html', {
        pageTitle: 'Subscription Management - PayLoc',
        moduleID: 'um-subscribe',
        product: result,
        stripeKey: config.stripe.stripePk,
        email: req.session.authApp.user.username,
        productName: result.name,
        quantity: config.sales.defaultQuantity
      })
    })
  } catch (e) {
    res.errorUI('An internal server error has occurred. ')
  }
});


async function getLoginOrg(req) {
  return await Organization.findOne({_id: req.session.authApp.user.authorizedOrgs}).exec()
}

// Apply a coupon to a new plan
router.post('/coupon/:SKU/:cusId', verifyLoginRedirect, async (req, res, next) => {
  const type = req.body.type
  if (type === 0) {
    // Customer ID
    if (req.params.cusId === '') {
      return res.error('Something went wrong. Please try again. ', 400);
    }
    const cusId = req.params.cusId;
    try {
      const stripeCustomer = await stripe.customers.retrieve(cusId).then();
      if (!stripeCustomer) {
        return res.error('This coupon code is invalid. ', 404);
      }
      if (stripeCustomer.metadata.orgId !== undefined) {
        // Disconnected user account
        // admin need to delete orgId through stripe dashboard
        return res.error('This coupon code has already been redeemed. ', 404);
      }
    } catch (e) {
      return res.error('This coupon code is invalid. ', 404);
    }
    try {
      const orgLinkedWithCusId = await Organization.find({billingCustomerId: cusId}).lean().exec();
      if (orgLinkedWithCusId.length > 0) {
        return res.error('This coupon code has already been redeemed. ', 404);
      }
    } catch (e) {
      return res.error('Something went wrong. Please try again. ', 500);
    }
    try {
      const org = await Organization.findOne({_id: req.session.authApp.user.authorizedOrgs}).exec();
      org.billingCustomerId = cusId;
      await stripe.customers.update(cusId, {
        description: org.name,
        email: req.session.authApp.user.username,
        metadata: {
          orgId: req.session.authApp.user.authorizedOrgs,
          managerName: req.session.authApp.user.name,
          sourceDesc: 'coupon code'
        }
      }).then();
      org.save();
      res.json({
        success: true
      })
    } catch (e) {
      return res.error('Something went wrong. Please try again. ', 500);
    }
  } else {
    // Coupon code
    const couponCode = req.params.cusId
    try {
      const coupon = await stripe.coupons.retrieve(couponCode).then();
      if (!coupon.valid) {
        return res.error('The coupon may not be applied at this time. Sorry!', 400);
      }
      const org = await getLoginOrg(req)
      const defaultProduct = subscription.getProduct(config.sales.defaultProductID)
      if (org.billingCustomerId !== '' && coupon.metadata.freeTrialOnly === "yes") {
        return res.error('This organization has already registered for free trial offer. If you think this is an error, please contact PayLoc Support. ', 401);
      }
      let source = undefined
      if (coupon.metadata.noCreditCard !== "yes") {
        source = req.body.token
        if (source === undefined || source === '') {
          return res.error('Please enter a valid payment method for this coupon', 400)
        }
        try {
          await stripe.tokens.retrieve(source)
        } catch (e) {
          return res.error('Your payment session has expired. Please try again. ', 400)
        }
      }
      let customer;
      if (org.billingCustomerId === '') {
        // Create a new customer
        customer = await stripe.customers.create({
          description: org.name,
          email: req.session.authApp.user.username,
          metadata: {
            orgId: req.session.authApp.user.authorizedOrgs,
            managerName: req.session.authApp.user.name
          },
          source: source
        })
        if (!customer) {
          return res.error('Something went wrong. Please try again. ', 500);
        }
        org.billingCustomerId = customer.id;
        await org.save();
      } else {
        customer = await stripe.customers.retrieve(org.billingCustomerId);
      }
      let items = [{
        plan: req.params.SKU,
        quantity: Number(req.body.quantity)
      }];
      if (config.sales.defaultUpsaleProductID !== '') {
        // by default put on premium
        // items.push({
        //   plan: config.sales.defaultUpsaleProductID,
        //   quantity: Number(req.body.quantity)
        // })
      }
      const product = await subscription.getProduct(config.sales.defaultProductID)
      await stripe.subscriptions.create({
        customer: customer.id,
        trial_period_days: product.trial_period_days,
        items: items,
        coupon: couponCode
      })
      res.json({
        success: true
      })
    } catch (e) {
      console.log(e)
      return res.error('The coupon you are looking for either expired or does not exist. ', 404);
    }
  }

});

router.post('/subscribe/:SKU', verifyLoginRedirect, async (req, res, next) => {
  //  || req.body.token === ''
  if (req.params.SKU === '' || req.body.token === undefined) {
    return res.error('Something went wrong. Please try again. ', 400);
  }
  if (Number(req.body.quantity) < config.sales.minimumSubscribeUser) {
    return res.error('You must subscribe at least ' + config.sales.minimumSubscribeUser + ' users. ', 400);
  }
  const org = await Organization.findOne({_id: req.session.authApp.user.authorizedOrgs}).exec()

  if (org.billingCustomerId !== '') {
    return res.error('This organization has already registered for free trial offer. If you think this is an error, please contact PayLoc Support. ', 500);
  }
  try{
    const product = await subscription.getProduct(config.sales.defaultProductID)
    const source = req.body.token
    const customer = await stripe.customers.create({
      description: org.name,
      email: req.session.authApp.user.username,
      metadata: {
        orgId: req.session.authApp.user.authorizedOrgs,
        managerName: req.session.authApp.user.name
      },
      source: source
    })
    org.billingCustomerId = customer.id;
    await org.save();
    let items = [{
      plan: req.params.SKU,
      quantity: Number(req.body.quantity)
    }];
    if (config.sales.defaultUpsaleProductID !== '') {
      // by default put on premium
      // items.push({
      //   plan: config.sales.defaultUpsaleProductID,
      //   quantity: Number(req.body.quantity)
      // })
    }
    await stripe.subscriptions.create({
      customer: customer.id,
      trial_period_days: product.trial_period_days,
      items: items
    })
    res.json({
      success: true
    })
  } catch (e) {
    return res.error('Something went wrong. Please try again. ', 500);
  }

});

router.get('/import', verifyLoginRedirect, (req, res, next) => {
  res.render('pages/importUsers.html', {
    pageTitle: 'Import User - PayLoc',
    moduleID: 'um-import'
  })
});

router.post('/import', verifyLoginRedirect, async (req, res, next) => {
  if (!req.files || !req.files.csvFile)
    return res.errorUI('No files were uploaded.', 400);

  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let csvFile = req.files.csvFile;
  let userQueuePromises = [];
  const csvPath = __dirname + '/../temp/' + uuidv4();
  await req.files.csvFile.mv(csvPath);
  csv()
    .fromFile(csvPath)
    .on('csv', (csvRowPassingOn) => {
      userQueuePromises.push((async (csvRow)=>{
        try {
          // csvRow is an array
          const userObj = {
            username: csvRow[0],
            name: csvRow[1],
            accessLevel: 99,
            phone: csvRow[3],
            hourlyRate: csvRow[4],
            addressLine1: csvRow[5],
            addressLine2: csvRow[6],
            addressZip: csvRow[7],
          };
          let user = {};
          // console.log(userObj);
          if (csvRow[2] === 'admin')
            user.accessLevel = 0;
          try {
            user = await createUser(userObj.username, userObj.name, req.session.authApp.user.authorizedOrgs, userObj.accessLevel, req.session.authApp.user._id, userObj.hourlyRate, userObj.phone)
          } catch (e) {
            // user creation error
            throw new Error(`Unable to create user ${userObj.name}: ${e.message}`);
          }
          if (userObj.addressLine1 !== undefined) {
            // start posting to scheduler to add address
            let schedulerAddress = config.schedulerAddress + '/api/payout/address';

            const titleEntitlement = user;
            delete titleEntitlement.password;
            const ticket = uuidv4();
            const expirationTimestamp = Math.floor(Date.now() / 1000) + 30;
            try {
              await Ticket.create({
                ticket: ticket,
                entitlement: titleEntitlement,
                expiration: expirationTimestamp,
                redeemed: false
              });
            } catch (e) {
              throw new Error(`Unable to add address for user ${userObj.name} - unable to issue a STS ticket`)
            }
            const options = {
              method: 'POST',
              uri: schedulerAddress,
              headers: {
                Authorization: `Bearer ${ticket}`
              },
              body: {
                primary_line: userObj.addressLine1,
                secondary_line: userObj.addressLine2,
                zip_code: userObj.addressZip,
              },
              json: true
            };
            try {
              const resultAPI = await rp(options);
              console.log(resultAPI)
            } catch (e) {
              throw new Error(`Unable to add address for user ${userObj.name}`)
            }
          }
          user.id = user._id;
          return user.toObject();
        } catch (e) {
          console.log(e)
          return e.message;
        }
      })(csvRowPassingOn));
    })
    .on('done',(error)=>{
      if (error) {
        return res.errorUI(error.message, 400);
      }
      Promise.all(userQueuePromises).then((users) => {
        // const fields = ['ID', 'Username', 'Password', 'HourlyRate', 'AddressLine1', 'AddressLine2', 'AddressZIP'];

        try {
          const csvfile = json2csv({ data: users });
          res.setHeader('Content-disposition', 'attachment; filename=import.csv');
          res.set('Content-Type', 'text/csv');
          res.status(200).send(csvfile);
        } catch (e) {
          logger.error({
            err: e
          });
          res.end(e.message, 500);
        }
      });
    })

});

async function sendPasswordText(org, createdUser) {
  await twilioClient.messages.create({
    body: `Welcome to ${org.name}! Your employer is using PayLoc to keep track of timesheets. To clock in and out, download the mobile app at https://goo.gl/BZJMDL. Your PayLoc username is ${createdUser.username} and your initial password is ${createdUser.password}`,
    to: '+1' + createdUser.phone.replace(/\D+/g, ''),  // Text this number
    from: '+16283000051' // From a valid Twilio number
  })
}

function generatePassword() {
  return randomWords() + randomstring.generate({
    length: 4,
    charset: 'numeric'
  });
}

async function createUser(username, name, orgId, accessLevel, actionUserId, hourlyRate, phone) {
  const password = generatePassword();
  if ((await User.findOne({username: username}).lean().limit(1).exec()) !== null) {
    throw new Error('This email address is already associated with a PayLoc account. Please use another email or contact support@payloc.io for more information')
  }
  const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
  const user = {
    name: name,
    username: username.toLowerCase(),
    authorizedOrgs: orgId,
    password: passwordHash,
    dateCreated: new Date(),
    accessLevel: accessLevel,
    changePasswordEnforced: true,
    creationChannel: 'orgAdmin-' + actionUserId,
    hourlyRate: hourlyRate,
    phone: phone
  };
  let createdUser =  (await User.create(user).then());
  const org = await getLoginOrg(req)
  createdUser.password = password;
  await sendPasswordText(org, createdUser)
  return createdUser
}

router.post('/create', verifyLoginRedirect, async (req, res, next) => {
  if (!req.body.username || !req.body.name || !req.body.accessLevel || !req.body.hourlyRate) {
    return res.error('Please enter all fields.', 400);
  }
  try {
    let username
    try {
      username = validator.normalizeEmail(req.body.username.toString()).toLowerCase();
    } catch (e) {
      res.error("Please enter a valid email address.", 400);
    }
    const name = req.body.name;
    const phone = req.body.phone;
    const accessLevel = req.body.accessLevel;
    const hourlyRate = req.body.hourlyRate;
    const orgId = req.session.authApp.user.authorizedOrgs;
    const userId = req.session.authApp.user._id;

    const org = await getLoginOrg(req)
    if (await delinquentStatus(org)) {
      return res.error("Your account is delinquent. Please correct your billing issues before adding a new user. ", 403);
    }

    const user = await createUser(username, name, orgId, accessLevel, userId, hourlyRate, phone);
    await triggerOrgStripeSeatCountUpdate(org)
    res.json({
      success: true,
      message: 'Username: ' + user.username + ' \nInitial password: ' + user.password + '\n\nPlease distribute information above to the employee. ',
      redirect: `/admin/user/${user._id}/edit`
    })
  } catch (e) {
    return res.error(e.message, 500);
  }
});

router.get('/user/:userId/edit', verifyLoginRedirect, (req, res, next) => {
  User.findOne({authorizedOrgs: req.session.authApp.user.authorizedOrgs, _id: req.params.userId}, (err, user) => {
    if (err || !user) {
      return res.redirect('/admin')
    }
    res.render('pages/useredit.html', {
      pageTitle: 'User Management - PayLoc',
      moduleID: 'um-edit',
      name: user.name,
      username: user.username,
      accessLevel: user.accessLevel,
      taxWithholding: {
        flatRate: user.taxWithholding.flatRate,
        percentage: user.taxWithholding.percentage
      },
      hourlyRate: user.hourlyRate,
      user: user
    })
  })
});

router.get('/user/:userId/delete', verifyLoginRedirect, (req, res, next) => {
  User.findOne({authorizedOrgs: req.session.authApp.user.authorizedOrgs, _id: req.params.userId}, (err, user) => {
    if (err || !user) {
      return res.redirect('/admin')
    }
    res.render('pages/deleteUser.html', {
      pageTitle: 'User Management - PayLoc',
      moduleID: 'um-delete',
      name: user.name,
      nameUpper: user.name.toUpperCase(),
      username: user.username,
    })
  })
})

router.post('/user/:userId/delete', verifyLoginRedirect, (req, res, next) => {
  User.remove({authorizedOrgs: req.session.authApp.user.authorizedOrgs, _id: req.params.userId}, async (err) => {
    if (err) {
      return res.error('An internal error occurred.', 500);
    } else {
      await triggerOrgStripeSeatCountUpdate(await getLoginOrg(req))
      return res.json({
        success: true
      })
    }
  })
});

router.post('/user/:userId/edit', verifyLoginRedirect, (req, res, next) => {
  if (!req.body.username || !req.body.name || !req.body.accessLevel) {
    return res.error('Please enter all fields.', 400);
  }
  const username = req.body.username
  const name = req.body.name
  const accessLevel = req.body.accessLevel
  const flatRate = req.body.flatRate
  const percentage = req.body.percentage
  const hourlyRate = req.body.hourlyRate
  User.findOne({authorizedOrgs: req.session.authApp.user.authorizedOrgs, _id: req.params.userId}, (err, user) => {
    if (err || !user) {
      return res.redirect('/admin')
    }
    if (!(validator.isEmail(req.body.username.toString()))){
      return res.error('Please enter a valid email address for username', 400)
    }
    if (!(validator.isInt(accessLevel))) {
      return res.error('An internal error occurred.', 500);
    }
    user.name = name
    user.username = username
    user.accessLevel = accessLevel
    user.hourlyRate = hourlyRate
    user.phone = req.body.phone
    user.taxWithholding.flatRate = flatRate
    user.taxWithholding.percentage = percentage

    user.save((err) => {
      if(err) {
        return res.error('An internal error occurred.', 500);
      }
      return res.json({
        success: true,
        message: "user updated"
      })
    })
  })
});

router.post('/user/:userId/resetPasswd', verifyLoginRedirect, (req, res, next) => {
  const password = generatePassword()
  bcrypt.genSalt(10, function(err, salt) {
    bcrypt.hash(password, salt, function(err, hash) {
      User.findOne({authorizedOrgs: req.session.authApp.user.authorizedOrgs, _id: req.params.userId}, (err, user) => {
        if (err || !user) {
          return res.error('An internal error occurred.', 500);
        }
        user.password = hash;
        user.changePasswordEnforced = true;
        user.save(async (err) => {
          if(err) {
            return res.error('An internal error occurred.', 500);
          }
          res.json({
            success: true,
            message: 'Username: ' + user.username + ' \nInitial password: ' + password + '\n\nPlease distribute information above to the employee. '
          })
          // send password async
          user.password = password
          const org = await getLoginOrg(req)
          await sendPasswordText(org, user)
        })
      })
    })
  })
})

router.get('/ajax/users', verifyLoginRedirect, (req, res, next) => {
  User.find({authorizedOrgs: req.session.authApp.user.authorizedOrgs}, (err, userArr) => {
    for (var i = 0; i < userArr.length; i++) {
      userArr[i] = userArr[i].toObject()
      delete userArr[i].password
      if (userArr[i].accessLevel > 0) {
        userArr[i].accessLevel = 'User'
      } else {
        userArr[i].accessLevel = 'Administrator'
      }
      // if (userArr[i]._id != req.session.authApp.user._id.toString()) { //user cannot edit themselves - prevent lock out
      userArr[i].edit = '<a href="/admin/user/' + userArr[i]._id + '/edit">Edit</a> <a href="/admin/user/' + userArr[i]._id + '/delete">Delete</a>'
      // } else {
      //   userArr[i].edit = ''
      // }
    }
    res.json(userArr)
  })
})


function verifyLoginRedirect(req, res, next) {
  if (req.session.authApp == undefined || req.session.authApp.user == undefined) {
    sessAuth.login(req, res)
  } else {
    if (req.session.authApp.user.accessLevel > 0) {
      sessAuth.login(req, res)
    } else{
      next()
    }
  }
}

async function delinquentStatus(org) {
  const customer = await stripe.customers.retrieve(org.billingCustomerId)
  return customer.delinquent
}

async function triggerOrgStripeSeatCountUpdate(org) {
  const billableUserCount = await User.count({authorizedOrgs: String(org._id)})
  const customer = await stripe.customers.retrieve(org.billingCustomerId)
  let subscriptionRetrievals = []
  for (let i = 0; i < customer.subscriptions.data.length; i++) {
    const subscriptionLineItems = customer.subscriptions.data[i].items.data
    let toUpdate = [];
    for (let i = 0; i < subscriptionLineItems.length; i++) {
      const subscriptionLineItem = subscriptionLineItems[i]
      toUpdate.push({
        id: subscriptionLineItem.id,
        quantity: billableUserCount
      })
    }
    subscriptionRetrievals.push(stripe.subscriptions.update(
      customer.subscriptions.data[i].id,
      { items: toUpdate }
    ));
  }
  await Promise.all(subscriptionRetrievals)
  return true
}

module.exports = router

const express = require('express'),
  router = express.Router(),
  OrgPayout = require('../../models/OrgPayout.js'),
  config = require('../../config.json'),
  mongoose = require('mongoose'),
  uuidv4 = require('uuid/v4'),
  _ = require('lodash'),
  sessAuth = require('../../helpers/sessAuth'),
  logger = require('../../helpers/logger'),
  render = require('../../helpers/render'),
  Lob = require('lob')(config.lobKey),
  LobProd = require('lob')(config.lobProdKey),
  stripe = require("stripe")(config.stripeSk),
  { forEach } = require('p-iteration');

router.get('/', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
  OrgPayout.findOne({
    orgId: req.session.auth.org._id
  }, (err, result) => {
    //console.log(result);
    if (result == null) {
      result = {};
      result.addressObj = {};
      result.stripeAccountObject = {};
    }
    if (result.addressObj === undefined) {
      result.addressObj = {}
    }
    if (result.stripeAccountObject === undefined) {
      result.stripeAccountObject = {}
    } else {
      req.session.bankId = result.stripeAccountId
    }

    const renderData = {
      payout: result.addressObj,
      stripe: result.stripeAccountObject,
      user: req.session.auth.user,
      stripeClientId: config.stripeClientId,
      org: req.session.auth.org,
      stripePk: config.stripePk
    };
    render.page(req, res, 'payrollConfigs.html', 'payrollConfigs', 'Configure Payroll', renderData)

    //console.log(render);
  });
});

router.post('/', sessAuth.verifyManagerLoginRedirect, async (req, res, next) => {
  const body = req.body;
  const orgId = req.session.auth.org._id;
  if (!body.tokenId || !body.first || !body.fourCode || !body.routing_number || !body.account_number) {
    return res.error('Please enter all required fields.', 400);
  }
  if (body.routing_number === "110000000") {
    body.routing_number = "021000021"; // replace stripe test routing number to a industry test routing number for lob
  }
  if (!req.session.bankId) {
    // return res.error('Please refresh and try again. ', 400); // session data not recorded when page was loaded
  }
  const addrIntId = uuidv4();
  LobProd.usVerifications.verify({
    primary_line: req.body.first,
    secondary_line: req.body.second,
    zip_code: req.body.fourCode
  }, async (err, addrVerified) => {
    //console.log (err, res);
    if (err) {
      logger.info({req: req, orgId: orgId, err: err}, 'invalid address - sourced from lob');
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
    const addressIds = await Lob.addresses.list({metadata: {orgId: orgId.toString()}});
    // console.log(addressIds);

    const addresses = addressIds.data;
    addresses.forEach((address) => {
      Lob.addresses.delete(address.id).then();
    });

    const bankIds = await Lob.bankAccounts.list({metadata: {orgId: orgId.toString()}});

    const banks = bankIds.data;
    banks.forEach((bank) => {
      Lob.bankAccounts.delete(bank.id).then();
    });

    try {
      const deleted = await stripe.customers.deleteSource(req.session.auth.org.billingCustomerId, req.session.bankId);
    } catch (e) {
      //do nothing because we literally dont care if theres nothing to delete
    }

    Lob.bankAccounts.create({
      description: req.session.auth.org.name + ' ' + addrIntId,
      routing_number: body.routing_number,
      account_number: body.account_number,
      signatory: req.session.auth.user.name,
      account_type: 'company',
      metadata: {
        orgId: req.session.auth.org._id.toString(),
        type: 'OrgPayout',
        addrIntId: addrIntId
      }
    }, () => {
      //  TODO: error handling
    });
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
        type: 'OrgPayout',
        addrIntId: addrIntId
      }
    },  (err, addr) => {
      console.log(addr);
      if (err || !addr) {
        logger.error({req: req, orgId: orgId, err: err, addr: addr}, 'Lob address verification API wrapper have thrown an exception');
        return res.error('An internal error occurred when validating your address. Please contact PayLoc support with your case ID ' + req.correlationID, 500);
      }

      stripe.customers.createSource(
        req.session.auth.org.billingCustomerId,
        { source: body.tokenId },
        (err, card) => {
          if (err || !card) {
            logger.error({req: req, orgId: orgId, err: err, card: card}, 'Stripe bankToken to source (attached to a client) have thrown an exception. ');
            return res.error('An internal error occurred when validating your bank account. Please contact PayLoc support with your case ID ' + req.correlationID, 500);
          }
          if (card.status === 'verification_failed') {
            // bank account is not verified against bank db
            stripe.customers.deleteSource(req.session.auth.org.billingCustomerId, card.id);
            return res.error('Your routing number or account number is incorrect. Please try again. ', 400);
          }
          OrgPayout.remove({
            orgId: req.session.auth.org._id
          }, () => {
            OrgPayout.create({
              orgId: req.session.auth.org._id,
              addrIntId: addrIntId,
              addressObj: addr,
              stripeAccountId: card.id,
              stripeAccountObject: card,
              status: card.status
            }, (err) => {
              if (err) {
                logger.error({req: req, orgId: orgId, err: err}, 'critical db error');
                return res.error('An internal error occurred.', 500);
              }
              res.json({
                success: true
              })
              global.IntercomClient.events.create({
                event_name: 'set-up-payroll',
                created_at: Math.round((new Date()).getTime() / 1000),
                user_id: req.session.auth.user._id
              });
              return
            })
          })
        }
      );

    });
  });
});
module.exports = router;
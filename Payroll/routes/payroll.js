const express = require('express'),
    router = express.Router(),
    Shift = require('../models/Shift.js'),
    Request = require('../models/Request.js'),
    Settings = require('../models/Settings.js'),
    User = require('../models/User.js'),
    Clock = require('../models/Clock.js'),
    ParentShift = require('../models/ParentShift.js'),
    UserPayout = require('../models/UserPayout.js'),
    OrgPayout = require('../models/OrgPayout.js'),
    PayRecord = require('../models/PayRecord.js'),
    request = require('request'),
    config = require('../config.json'),
    rp = require('request-promise'),
    mongoose = require('mongoose'),
    SparkPost = require('sparkpost'),
    uuidv4 = require('uuid/v4'),
    moment = require('moment'),
    randomstring = require('randomstring'),
    _ = require('lodash'),
    sessAuth = require('../helpers/sessAuth'),
    logger = require('../helpers/logger'),
    render = require('../helpers/render'),
    validator = require('validator'),
    Lob = require('lob')(config.lobKey),
    LobProd = require('lob')(config.lobProdKey),
    stripe = require("stripe")(config.stripeSk),
    escape = require('escape-html'),
    { forEach } = require('p-iteration');

router.all('*', sessAuth.verifyPayroll, (req, res, next) => {
  next();
});

router.use('/employee', sessAuth.verifyManagerLoginRedirect, require('./payroll/employeeHistory'));

router.all('*', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
  next();
});

router.get('/', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
  render.page(req, res, 'payroll.html', 'payroll', 'Payroll');
});

router.use('/history', sessAuth.verifyManagerLoginRedirect, require('./payroll/history'));

/**
 * Generate a payment table populated with clock records
 */
router.get('/table', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
    const orgId = req.session.auth.org._id;
    req.session.payrollEmployeeIds = {};
    req.session.payrollEmployeePayouts = {};
    //console.log(orgId);
    Clock.find({orgId: orgId, paid: false, completed: true}).populate('employeeId shift').lean().exec((err, clocks) => {
        if (err) {
            return res.error('An internal error occurred.', 500);
        }

        // Start Calculating Clock Records
        let payoutPromises = [];
        let issues = '';
        for (let i = 0; i < clocks.length; i++) {
            req.session.payrollEmployeeIds[clocks[i].employeeId._id] = clocks[i].employeeId;
            // clocks[i] = clocks[i].toObject();
            clocks[i].clockLength = moment(clocks[i].endTime).diff(clocks[i].startTime, 'minutes');
            clocks[i].shiftLength = moment(clocks[i].shift.endTime).diff(clocks[i].shift.startTime, 'minutes');
            // console.log(clocks[i].clockLength);
            // console.log(clocks[i].employeeId.hourlyRate);
            clocks[i].OTLength = clocks[i].violationValue;
            if (clocks[i].OTLength < 0) {
                clocks[i].OTLength = 0 //no negative OT
            }
            clocks[i].OT = clocks[i].OTLength > 0;
            clocks[i].name = escape(clocks[i].employeeId.name);
            clocks[i].date = moment(clocks[i].startTime).format('MM/DD/YYYY');
            clocks[i].startTime = moment(clocks[i].startTime).format('HH:mm');
            clocks[i].endTime = moment(clocks[i].endTime).format('HH:mm');

            if (clocks[i].OTLength > 0) {
                clocks[i]["overtime"] = '<div class="OT">' + clocks[i].OTLength.toString() + ' mins</div>'
            } else {
                clocks[i]["overtime"] = '<div class="">' + clocks[i].OTLength.toString() + ' mins</div>'
            }

            let pay;
            if (clocks[i].employeeId.hourlyRate === undefined){
                pay = ''
            } else {
                pay = Number(clocks[i].clockLength * (clocks[i].employeeId.hourlyRate / 60)).toFixed(2)
            }
            clocks[i].pretaxPayment = '<div class="input-field inline"><i class="material-icons prefix">attach_money</i><input type="text" class="validate" data-length="' + clocks[i].clockLength + '" data-clock="' + clocks[i]._id + '" data-id="' + clocks[i].employeeId._id + '" value="' + pay + '"></div>'
            //sanitization
            delete clocks[i].employeeId;
            delete clocks[i].shift;
            delete clocks[i].orgId;
            delete clocks[i].paid;
            //console.log('length: ' + length);
            //clocks[i].employeeId.hourlyRate
        }


        // Start Checking Payout Method for Employees
        Object.keys(req.session.payrollEmployeeIds).forEach((employeeId) => {
            payoutPromises.push(UserPayout.findOne({user: req.session.payrollEmployeeIds[employeeId]._id, orgId: req.session.auth.org._id}).exec());
        });
        Promise.all(payoutPromises).then(employeePayouts => {
            // console.log(employeePayouts);
            var i = 0;
            Object.keys(req.session.payrollEmployeeIds).forEach((employeeId) => {
                if (employeePayouts[i] === null) {
                    if (issues === '') {
                        issues = '<p>Please address the following issues before continuing</p>'
                    }
                    issues += '<li>' + escape(req.session.payrollEmployeeIds[employeeId].name) + ' does not have a payment method on file. Please ask ' + escape(req.session.payrollEmployeeIds[employeeId].name) + ' login to scheduler portal and select a payment method. </li>'
                } else {
                    req.session.payrollEmployeePayouts[employeeId] = employeePayouts[i]
                }
                i++
            });
            var disabledContinue = false
            if (issues !== '') {
                //issues += '</ul>'
                disabledContinue = true
            }
            if (clocks.length === 0) {
                disabledContinue = true
                issues = 'There is no unpaid shifts'
            }
            res.json({
                table: clocks,
                issues: issues,
                disabledContinue: disabledContinue
            })
        })
    })
});


/**
 * Convert a list of clocks to payroll waiting for confirmation
 */
router.post('/pretax', sessAuth.verifyManagerLoginRedirect, async (req, res, next) => {
    const payrollId = uuidv4();

    req.session.payroll = {};
    req.session.payroll.request = {};
    req.session.payroll.request[payrollId] = JSON.parse(req.body.data);

    var table = [];       // Table rendered for confirmation
    var employeePay = {}; // An object containing employeeId: {pay: paymentAmount}
    var total = 0;        // Total amount to be paid during this paycycle
    var stripeTotal = 0;  // Amount to be paid through ACH
    var payItems = {};    // employeeId: [PayItem]

    try {
      await forEach(req.session.payroll.request[payrollId], async (payObj) => {
        if (employeePay[payObj.employeeId] === undefined) {
          employeePay[payObj.employeeId] = {};
          employeePay[payObj.employeeId].pay = parseFloat(payObj.pay);
          employeePay[payObj.employeeId].workedMinutes = parseFloat(payObj.workedMinutes)
        } else {
          employeePay[payObj.employeeId].pay += parseFloat(payObj.pay);
          employeePay[payObj.employeeId].workedMinutes += parseFloat(payObj.workedMinutes)
        }

        const clock = (await Clock.find({
          _id: mongoose.Types.ObjectId(payObj.clockId),
          orgId: req.session.auth.org._id
        }).limit(1).lean().exec())[0];

        if (!clock)
          throw new Error('Clock record for ' + payObj.clockId + ' is not found');

        // Construct PayItem array
          const payItem = {
            title: moment(clock.startTime).format('MMM Do YYYY, h:mm a') + ' to ' + moment(clock.endTime).format('MMM Do YYYY, h:mm a'),
            amount: parseFloat(payObj.pay),
            workedMinutes: parseFloat(payObj.workedMinutes),
            clockId: clock._id,
            shiftId: clock.shift
          };
          if (payItems[payObj.employeeId] === undefined) {
            payItems[payObj.employeeId] = []
          }
          payItems[payObj.employeeId].push(payItem)
      });
    } catch (e) {
      logger.error({
        err: e,
        userId: req.session.auth.user._id,
        orgId: req.session.auth.org._id,
      }, 'error pre-processing payroll');
      console.log(e);
      return res.error('Invalid request. Please try again or contact PayLoc support', 400)
    }
    // console.log(payItems)
  // Each employee = key
  await Object.keys(employeePay).forEach((key) => {
        const employee = req.session.payrollEmployeeIds[key];
        // console.log(employee);
        const pretax = employeePay[key].pay;
        // console.log(pretax);
        if (employee.taxWithholding === undefined) {
            employee.taxWithholding = {};
            employee.taxWithholding.percentage = 0;
            employee.taxWithholding.flatRate = 0
        }
        if (employee.taxWithholding.percentage === undefined) {
            employee.taxWithholding.percentage = 0
        }
        if (employee.taxWithholding.flatRate === undefined) {
            employee.taxWithholding.flatRate = 0
        }
        const taxWithholding = (Math.round((pretax * (employee.taxWithholding.percentage / 100)) * 100) / 100)  + employee.taxWithholding.flatRate
        const aftertaxPayment = ((Math.round(pretax * 100) / 100) - (Math.round(taxWithholding * 100) / 100)).toFixed(2)
        var preferredPayoutMethod = '';
        /**  console.log(req.session);
         console.log(key);
         console.log('employee: ' + req.session.payrollEmployeeIds[key]);
         console.log(req.session.payrollEmployeePayouts[key]); **/
        if (req.session.payrollEmployeePayouts[key].preferredPayoutMethod === 'stripe') {
            preferredPayoutMethod = 'Direct Deposit';
            stripeTotal += parseFloat(aftertaxPayment)
        } else {
            preferredPayoutMethod = 'Paper Check'
        }
        table.push({
            id: employee._id,
            name: escape(employee.name),
            hourlyRate: employee.hourlyRate,
            workedMinutes: escape(employeePay[key].workedMinutes),
            pretaxPayment: pretax,
            taxWithholding: taxWithholding,
            aftertaxPayment: aftertaxPayment,
            payoutMethod: preferredPayoutMethod
        })
        // console.log(employeePay);
        total += parseFloat(aftertaxPayment)

    })
    req.session.payroll['payItems' + payrollId] = payItems;
    req.session.payroll['table' + payrollId] = table;
    req.session.payroll['total' + payrollId] = total;
    req.session.payroll['stripeTotal' + payrollId] = stripeTotal;
    req.session.payroll['stripeTotal' + payrollId] = stripeTotal;
    const orgId = req.session.auth.org._id;
    const orgSettings = await Settings.findOne({orgId: orgId}).lean().exec();
    req.session.payroll['testmode' + payrollId] = orgSettings.testmode;

    res.end(payrollId)
})

router.get('/:payrollId', sessAuth.verifyManagerLoginRedirect, async (req, res, next) => {
    const payrollId = req.params.payrollId;
    if (req.session.payroll === undefined || req.session.payroll.request === undefined) {
        return res.redirect('/')
    }
    if (req.session.payroll.request[payrollId] === undefined) {
        return res.error('An internal error occurred.', 500);
    }
    const orgId = req.session.auth.org._id;
    const table = req.session.payroll['table' + payrollId];
    // console.log(table);
    const renderingData = {
        payrollId: escape(req.params.payrollId),
        table: JSON.stringify(table),
        user: req.session.auth.user,
        total: req.session.payroll['total' + payrollId],
        testmode: req.session.payroll['testmode' + payrollId]
    };
    render.page(req, res, 'payrollConfirm.html', 'payrollConfirm', 'Payroll Preview', renderingData);
    global.IntercomClient.events.create({
      event_name: 'generated-payroll',
      testmode: req.session.payroll['testmode' + payrollId],
      created_at: Math.round((new Date()).getTime() / 1000),
      user_id: req.session.auth.user._id,
      metadata: { amount: renderingData.total}
    });
});

router.post('/pay/:payrollId', sessAuth.verifyManagerLoginRedirect, async (req, res, next) => {
  const payTable = JSON.parse(req.body.data);
  const payrollId = req.params.payrollId;
  const humanDate = moment().format('MM/DD/YYYY');
  const transfer_group = uuidv4();

  try {
    const orgId = req.session.auth.org._id;
    const orgPayout = await OrgPayout.findOne({orgId: req.session.auth.org._id}).lean().exec();
    const orgSettings = await Settings.findOne({orgId: orgId}).lean().exec();

    if (orgPayout === undefined) {
      return res.error('Please configure your payroll feature before submitting a payroll. ', 400);
    }
    if (orgPayout.rejected) {
      return res.error('Please contact PayLoc support for more information. Your organization ID ' + req.session.auth.org._id, 401);
    }
    if (!orgPayout.enabled) {
      return res.error('Your account is disabled. Please contact PayLoc support for more information. Your organization ID ' + req.session.auth.org._id, 401);
    }
    logger.info({req: req, orgId: orgId, amnt: req.session.payroll['stripeTotal' + payrollId]}, 'payroll request created');
    const stripeInitChargeAmount = 100 * req.session.payroll['stripeTotal' + payrollId];
    const testmode = req.session.payroll['testmode' + payrollId];
    const stripeClient = stripe;
    const lobClient = LobProd;

    if (stripeInitChargeAmount !== 0 && !testmode) {
      const charge = await stripeClient.charges.create({
        amount: stripeInitChargeAmount,
        currency: "usd",
        customer: orgPayout.stripeAccountObject.customer,
        source: orgPayout.stripeAccountId,
        transfer_group: transfer_group,
      });
      if (charge.captured !== true) {
        logger.error({
          req: req,
          orgId: orgId,
          charge: charge
        }, 'Unable to capture charge through Stripe');
        return res.error('We are unable to authorize fund through ACH. Please double check your account balance and try again. ', 400);
      }
    }

    const banks = await lobClient.bankAccounts.list({metadata: {orgId: orgId.toString()}});
    if (banks.count !== 1) {
      // console.log(banks, addressIds);
      return res.error('Please contact your PayLoc sales representative to set up payroll feature. ', 401);
    }
    const addressIds = orgPayout;
    logger.info({req: req, orgId: orgId, banks: banks}, 'banks retrieved');
    const amountDollar = req.session.payroll['stripeTotal' + payrollId];
    global.IntercomClient.events.create({
      event_name: 'submitted-payroll',
      testmode: testmode,
      created_at: Math.round((new Date()).getTime() / 1000),
      user_id: req.session.auth.user._id,
      metadata: { amount: amountDollar, setUpPayroll: banks.count === 1 }
    });
    const bank = banks.data[0].id;
    const address = addressIds.addressObj.id;
    var failedPayment = false;
    try {
      await forEach(payTable, async (payRecord) => {
        const payId = uuidv4();  // Unique ID identifying this payment - will be printed on the check
        const employeeId = mongoose.Types.ObjectId(payRecord.id);
        let payRecordDB = {
          orgId: orgId,
          employeeId: employeeId,
          payId: payId,
          amount: payRecord.aftertaxPayment,
          items: req.session.payroll['payItems' + payrollId][employeeId]
        }; // Common payrecord value for both check and ACH payment

        if (req.session.payrollEmployeePayouts[payRecord.id].preferredPayoutMethod !== 'stripe') {
          // Check Payment

          let lobTargetAddress = req.session.payrollEmployeePayouts[payRecord.id].addressObj.id;
          if (orgSettings.oneAddressMode) {
            // Redirect to org address
            lobTargetAddress = address;
          }
          let lobClientToUse = lobClient;
          if (testmode) {
            lobClientToUse = Lob
          }
          const result = await lobClient.checks.create({
            bank_account: bank,
            to: lobTargetAddress,
            from: address,
            amount: payRecord.aftertaxPayment,
            memo: moment().format('MM/DD/YYYY'),
            logo: 'https://s3-us-west-1.amazonaws.com/payloc/square.png',
            check_bottom: '<p style="padding-top: 4in;">Paycheck for {{name}}</p><br>\
							<p>Pre-Tax Payment: ${{pretaxPayment}}</p> \
							<p>Tax Withholding as required by IRS: ${{taxWithholding}}</p> \
							<p>Final Paycheck Amount: ${{aftertaxPayment}}</p> \
							<br> \
							<p>Questions? Please contact {{orgName}} HR Department or your manager. </p> \
							<p>Payment ID: {{payId}} </p> \
							',
            merge_variables: {
              name: payRecord.name,
              pretaxPayment: payRecord.pretaxPayment,
              taxWithholding: payRecord.taxWithholding,
              aftertaxPayment: payRecord.aftertaxPayment,
              orgName: req.session.auth.org.name,
              payId: payId
            },
            metadata: {
              payId: payId
            }
          });
          payRecordDB = _.merge(payRecordDB, {
            target: lobTargetAddress,
            type: 'lob',
            paymentInfo: result
          });
        } else {
          const stripeAmount = payRecord.aftertaxPayment * 100;
          const stripeAccountId = req.session.payrollEmployeePayouts[payRecord.id].stripeAccountId;
          if (!testmode) {
            let transfer = await stripeClient.transfers.create({
              amount: stripeAmount,
              currency: "usd",
              destination: stripeAccountId,
              transfer_group: transfer_group,
              source_transaction: charge.id,
              metadata: {
                payId: payId
              }
            });
            // console.log(transfer);
            let payout = await stripeClient.payouts.create({
              amount: stripeAmount,
              currency: "usd",
              description: req.session.auth.org.name + ' payout on ' + humanDate + ' for your paycheck',
              method: "standard",
              statement_descriptor: req.session.auth.org.name + '-PAYLOC',
              metadata: {
                payId: payId
              }
            }, {stripe_account: stripeAccountId});
          } else {
            let transfer = {
              description: 'testmode'
            };
            let payout = {
              description: 'testmode'
            }
          }
          payRecordDB = _.merge(payRecordDB, {
            target: stripeAccountId,
            type: 'stripe',
            paymentInfo: {
              transfer: transfer,
              payout: payout
            }
          });
          // console.log(payout);
        }
        payRecordDB = await PayRecord.create(payRecordDB);
        await Clock.update({
          orgId: req.session.auth.org._id,
          employeeId: payRecordDB.employeeId
        }, {
          $set: {
            paid: true,
            payRecord: payRecordDB._id
          }
        }, {
          multi: true
        }).exec();
      });
    } catch (e) {
      // Payment Failure
      if (config.dev)
        console.log(e);
      logger.error({
        req: req,
        orgId: orgId,
        err: e
      }, 'Payment Failure');
      failedPayment = true;
    }
    req.session.payRecord = {};
    req.session.payroll = {};
    req.session.payrollEmployeePayouts = {};
    req.session.payrollEmployeeIds = {};
    let message = 'Employees who are using direct deposit should receive their payments by the next business day. Otherwise, USPS will pick up paper checks daily at 2PM PST.';
    if (failedPayment) {
      message += ' Some payment have failed. Please run payroll again to reattempt those failed payments. Contact PayLoc support if you have any question. ';
    }
    res.json({
      success: true,
      message: message
    })




  } catch (e) {
    // Abort action - stop further processing
    logger.error({
      err: e,
      session: req.session
    }, 'Unable to update clock record');
    if (config.dev)
      console.log(e);
    return res.error('An internal error occurred while processing your payments. Please contact PayLoc with correlation ID' + req.session.correlationID);
  }


});


module.exports = router;

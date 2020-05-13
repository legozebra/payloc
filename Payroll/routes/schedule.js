const express = require('express'),
    router = express.Router(),
    Shift = require('../models/Shift.js'),
    Clock = require('../models/Clock.js'),
    Request = require('../models/Request.js'),
    User = require('../models/User.js'),
    ParentShift = require('../models/ParentShift.js'),
    UserPayout = require('../models/UserPayout.js'),
    request = require('request'),
    config = require('../config.json'),
    rp = require('request-promise'),
    mongoose = require('mongoose'),
    SparkPost = require('sparkpost'),
    uuidv4 = require('uuid/v4'),
    moment = require('moment'),
    _ = require('lodash'),
    sessAuth = require('../helpers/sessAuth'),
    render = require('../helpers/render'),
    validator = require('validator'),
    Settings = require('../models/Settings'),
    timezone = require('moment-timezone'),
    logger = require('../helpers/logger'),
    escape = require('escape-html'),
    { forEach } = require('p-iteration');

const shiftRequestPrefix = 'ShiftRequest';

const getOrgShift = async (conditions, settings = {}, req) => { // deparcated
  try {
    const shifts = await getShifts(conditions);
    if (shifts === null) {
      return [];
    }

    return await renderShifts(shifts, settings, req);
  } catch (e) {
    throw e;
  }
};

const getShifts = async (conditions) => {
  return await Shift.find(conditions).populate('employeeIds').lean().exec();
};

const renderShifts = async (shifts, settings, req) => {
  let renderedShift = [];
  shifts.forEach((shift) => {
    renderedShift.push((async (shiftNow, settings, req) => {
      //console.log(settings)
      const rShift = Object.assign({}, settings); // shift currently being constructed. starting with existing setting *settings are literally merged into shift array*
      var people = [];
      var title = '';
      await shiftNow.employeeIds.forEach((employeeId) => {
        if (settings.sensitive === true) {
          people.push(employeeId)
        } else {
          people.push({
            name: employeeId.name,
            id: employeeId._id
          })
        }
      });
      rShift.people = people;
      rShift.id = shiftNow._id;
      rShift.allDay = false;
      rShift.title = '';
      rShift.start = moment(shiftNow.startTime).tz(req.session.orgSettings.Timezone).format();
      rShift.end = moment(shiftNow.endTime).tz(req.session.orgSettings.Timezone).format();
      rShift.pastShift = false;

      if (moment.tz(shiftNow.startTime, req.session.orgSettings.Timezone).utc().diff(moment().toDate()) < req.session.orgSettings.OT_Tolorance) {
        // Shift happened in the past.
        // Querying clock record for color-coding
        // Also prohibiting editing
        rShift.pastShift = true; // So the client can disable shift exchange button accordingly
        rShift.editable = false; // This overrides the master editable property. If not set, editable or not will depend on the user permission set.
        const clocks = await Clock.find({
          orgId: req.session.auth.org._id,
          shift: mongoose.Types.ObjectId(rShift.id)
        }).exec();
        await rShift.people.forEach((person, index) => {
          if (_.find(clocks, {employeeId: mongoose.Types.ObjectId(person.id)}) === undefined) {
            // This dude did not clock in! Boi time to write him up..
            rShift.people[index].name = '? ' + person.name;
            rShift.color = '#ec0112';
          }
        })
      }
      //.tz(req.session.orgSettings.Timezone);
      await rShift.people.forEach((employee) => {
        rShift.title += employee.name + '\n';
      });
      return rShift;
    })(shift, settings, req))
  });
  return _.flatten(await Promise.all(renderedShift));
};


router.get('/', sessAuth.verifyLoginRedirect, (req, res, next) => {
    UserPayout.findOne({
        orgId: req.session.auth.org._id,
        user: req.session.auth.user._id
    }, (err, result) => {
        if (!result && req.session.auth.premiumProduct) {
            res.redirect('/settings/payroll')
        } else {
            render.page(req, res, 'calendar.html', 'calendar', 'Your Shifts');
        }
    })
});

router.get('/manager', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
    if (req.session.auth.user.accessLevel > 0) {
        res.redirect('/')
    } else {
        render.page(req, res, 'calManager.html', 'calManager', 'Manage Shifts');
    }
});

function getStartTime(start, timezone, end) {
    if (start === "now") {
      return {
        $gte: moment().utc().toISOString().replace('/GMT/i', ''),
        $lte: moment.tz(end, timezone).utc().add(2, 'day').toISOString().replace('/GMT/i', '') // this is just a hack. if you have any idea to make it not a hack, go for it but you are gonna fail. --johnnyw@payloc
      };
    } else {
      return {
        $gte: moment.tz(start, timezone).utc().subtract(2, 'day').toISOString().replace('/GMT/i', ''),
        $lte: moment.tz(end, timezone).utc().add(2, 'day').toISOString().replace('/GMT/i', '') // this is just a hack. if you have any idea to make it not a hack, go for it but you are gonna fail. --johnnyw@payloc
      };
    }
}

function getStartTimeReq(req) {
  //  get start time query parameter base on express req. only works on fullcalendar requests.
  const start = req.query.start;
  const end = req.query.end;
//  console.log(req.session.auth.user._id)
  const timezone = req.session.orgSettings.Timezone;
  return getStartTime(start, timezone, end)
}

router.get('/schedule', sessAuth.verifyLoginRedirect, async (req, res, next) => {
  const start = req.query.start;
  const end = req.query.end;
  if (start === null || end === null) {
    return res.json([])
  }
  const startTime = getStartTimeReq(req);
  const conditions = [
    {
      settings: {color: '#3d77d3', ownShift: true},
      shiftsPromise: getShifts({
        orgId: req.session.auth.org._id,
        published: true,
        startTime: startTime,
        employeeIds: mongoose.Types.ObjectId(req.session.auth.user._id)
      })
    },
    {
      settings: {color: 'black', ownShift: false},
      shiftsPromise: getShifts({
        orgId: req.session.auth.org._id,
        published: true,
        startTime: startTime,
        employeeIds: {
          '$ne': mongoose.Types.ObjectId(req.session.auth.user._id)
        }
      })
    }
  ];

  try {
    let renderShiftPromises = []; // Each promise indivdually get shift from db and render it. then we use a promise.all to execute them in parallel.
    conditions.forEach((condition) => {
      renderShiftPromises.push((async () => {
        const shifts = await condition.shiftsPromise;
        return await renderShifts(shifts, condition.settings, req);
      })())
    });
    const renderedShifts = _.flatten(await Promise.all(renderShiftPromises)); //flatten it because frontend need an array of shifts, it does not care about conditions.
    res.json(renderedShifts);
  } catch (e) {
    if (config.dev)
      console.log(e);
    logger.error(e);
    res.json([]);
  }

});

router.get('/schedule/tradeOff/:shiftId', sessAuth.verifyLoginRedirect, (req, res, next) => {
    if (req.query.start == null || req.query.end == null) {
        return res.json([])
    }
  const startTime = getStartTime("now", req.session.orgSettings.Timezone, req.query.end);
    const shiftId = req.params.shiftId;
    Shift.findOne({_id: shiftId}, (err, shiftR) => {
        //http://localhost:3001/scheduler/schedule/tradeOff/5952c43a7856f64c653356a5?start=2017-06-25&end=2017-07-02&_=1498596621222
        //console.log(shiftR)
        if (err || !shiftR) {
            return res.json([])
        }
        const shift = shiftR.toObject()
        delete shift.employeeIds.find((employeeObj) => {return employeeObj == mongoose.Types.ObjectId(req.session.auth.user._id)})

        var queryDate = new Date()
        if (new Date(req.query.start) > queryDate) {
            queryDate = new Date(req.query.start)
        }
        const conditions = {
            orgId: req.session.auth.org._id,
            published: true,
            startTime: startTime,
            employeeIds: {
                $ne: req.session.auth.user
            }
        };
        getOrgShift(conditions, {color: 'black'}, req).then((shiftResult) => {
            //console.log(shift);
            console.log(shiftResult);
            shiftR.populate('employeeIds', (err) => {
                if (err) {
                    return res.json([])
                }
                /**
                 shiftResult.forEach((eligibleShift, index, original) => {
          //console.log('hit')
          //console.log( eligibleShift.people)
          for (var index of reverseKeys(eligibleShift.people)) {
            if (_.find(shiftR.employeeIds, '_id', eligibleShift.people[index]._id) === undefined) {
              console.log('removed')
              eligibleShift.people.splice(index, 1);
            }
          }
/**
          var all = _.union(eligibleShift.people, shiftR.employeeIds);
          var common = _.intersectionWith(eligibleShift.people, shiftR.employeeIds);
          var answer = _.difference(eligibleShift.people, common)
          console.log('common: ' + common);
          console.log('answer: ' + answer); **/ /**
                 console.log('eligibleShift: ' + eligibleShift.people);
                 //console.log('shiftR: ' + shiftR.employeeIds);

                 for (var index of reverseKeys(eligibleShift.people)) {
            const newPerson = {}
            newPerson.name = eligibleShift.people[index].name
            newPerson.id = eligibleShift.people[index]._id
            eligibleShift.people[index] = newPerson
          }

                 original[index] = eligibleShift

                 })**/
                    //console.log(shift.employeeIds);

                var x = shift.employeeIds.length
                while (x--) {
                    //console.log(shift.employeeIds[x]);
                    shift.employeeIds[x] = shift.employeeIds[x].toString()
                }

//console.log(shift.employeeIds);

                var i = shiftResult.length
                while (i--) {
                    var x = shiftResult[i].people.length
                    while (x--) {
                        console.log(shift.employeeIds.indexOf(shiftResult[i].people[x].id.toString()) !== -1 );
                        if (shift.employeeIds.indexOf(shiftResult[i].people[x].id.toString()) !== -1 ) {
                            console.log('removed');
                            shiftResult[i].people.splice(x, 1);
                        }
                    }
                    if (shiftResult[i].people.length == 0) {
                        shiftResult.splice(i, 1);
                    }
                }
                return res.json(shiftResult)
            })
        }).catch((err) => {
            console.log(err)
            return res.json([])
        })
    })
})

function* reverseKeys(arr) {
    var key = arr.length - 1;

    while (key >= 0) {
        yield key;
        key -= 1;
    }
}

router.post('/tradeOff/:shiftId/to/:newShiftId/with/:requestee', sessAuth.verifyLoginRedirect, (req, res, next) => {
    Shift.findOne(
        {
            orgId: req.session.auth.org._id,
            published: true,
            _id: req.params.shiftId,
            employeeIds: mongoose.Types.ObjectId(req.session.auth.user._id)

        }, (err, oldShift) => {
            if (err || !oldShift) {
                console.log(err)
                return res.error('An internal error occurred.', 500);
            }
            delete oldShift.employeeIds.find((employeeObj) => {return employeeObj == mongoose.Types.ObjectId(req.session.auth.user._id)})
            var employeeIdsObjId = []
            oldShift.employeeIds.forEach((employeeId) => {
                employeeIdsObjId.push(mongoose.Types.ObjectId(employeeId))
            })
            const conditions = {
                orgId: req.session.auth.org._id,
                published: true,
                employeeIds: {
                    $eq: mongoose.Types.ObjectId(req.params.requestee),
                    $ne: mongoose.Types.ObjectId(req.session.auth.user._id)
                },
                _id: req.params.newShiftId
            }
            Shift.findOne(conditions, (err, newShift) => {
                if (err || !newShift) {
                    return res.error('An internal error occurred.', 500);
                }
                const userRetrievalKey = uuidv4()
                const orgId = req.session.auth.user.authorizedOrgs
                Request.create({
                    orgId: orgId,
                    oldShift: oldShift,
                    newShift: newShift,
                    requester: req.session.auth.user._id,
                    requestee: req.params.requestee,
                    userRetrievalKey: userRetrievalKey,
                    approved: false
                }, (err, request) => {
                    if (err || !request) {
                        return res.error('An internal error occurred.', 500);
                    }
                    User.findOne({_id: req.params.requestee, authorizedOrgs: orgId}, (err, user) => {
                        User.findOne({_id: req.session.auth.user._id, authorizedOrgs: orgId}, (err, requester) => {
                          Settings.findOne({orgId: orgId}, (err, orgSettings) => {
                            const acceptLink = req.protocol + '://' + req.get('host') + '/scheduler/accept/' + userRetrievalKey
                            const sparky = new SparkPost(config.sparkPostToken) //email client
                            console.log('email sent')
                            sparky.transmissions.send({
                              options: {
                                sandbox: false //do not set this to true - limited to 5 test emails for lifetime
                              },
                              content: {
                                from: 'PayLoc <' + shiftRequestPrefix + '+' + userRetrievalKey + '@system.payloc.io>',
                                subject: 'Shift Exchange Request From ' + requester.name,
                                html: '<html><body><p>Dear ' + user.name + ', </p> \
                <p>You have received a shift exchange request from ' + requester.name + '. If you would like to accept this exchange, simply reply YES to this email or click <a href="' + acceptLink + '">here</a>. </p> \
                <p>Your current shift: ' + moment(newShift.startTime).tz(orgSettings.Timezone).format('dddd, MMMM Do, YYYY, h:mm a') + ' to ' + moment(newShift.endTime).tz(orgSettings.Timezone).format('h:mm a') + '. </p>          \
                <p>Proposed new shift: ' + moment(oldShift.startTime).tz(orgSettings.Timezone).format('dddd, MMMM Do, YYYY, h:mm a') + ' to ' + moment(oldShift.endTime).tz(orgSettings.Timezone).format('h:mm a') + '. </p> <br>\
                <p>PayLoc <br><i>on behalf of ' + req.session.auth.org.name + '</i></p> \
                </body></html>'
                              },
                              recipients: [
                                {address: user.username}
                              ]
                            })  // user.username
                              .then(data => {
                                return res.json({
                                  message: 'The change will be made once ' + user.name + ' approves the change. '
                                })
                              })
                              .catch(err => {
                                console.log(err)
                                return res.error('An internal error occurred.', 500);
                              });
                          })
                        })
                    })

                })
            })
        })
})

router.get('/accept/:userRetrievalKey', sessAuth.verifyLoginRedirect, (req, res, next) => {
    // console.log(req.session.auth.user)
    Request.findOne({userRetrievalKey: req.params.userRetrievalKey}).populate('requester').populate('requestee').exec((err, request) => {
        if (err || !request) {
            return res.error('An internal error occurred.', 500);
        }
        console.log(request.requestee[0]._id)
        if (req.session.auth.user._id.toString() !== request.requestee[0]._id.toString()) {
            // return res.errorUI('Access denied', 403);
            // since this can be approved without logging in, there's no point of checking username
        }
        requestApproved(request)
        res.messageBox("Exchange Approved", "Your exchange has been approved.")

    })
})

router.get('/tradeOff/webhook/', (req, res, next) => {
    if (req.get('X-Messagesystems-Webhook-Token') !== config.sparkPostWebhookToken) {
        return res.error('Unauthorized', 401);
    }
    const relayMessage = req.params[0].msys.relay_message
    const address = relayMessage.rcpt_to.toLowerCase()
    const content = relayMessage.content.text.toLowerCase()
    const from = relayMessage.friendly_from.toLowerCase() //netsecNote: This is accurate - not the header `from`

    if (content.find('yes') == -1) {
        return res.error('No consent word in email body', 500);
    }

    if (address.substring(0, shiftRequestPrefix.length) !== shiftRequestPrefix) {
        //wrong address
        return res.error('Invalid email address', 400);
    }
    const userRetrievalKey = address.substring(shiftRequestPrefix.length, shiftRequestPrefix.length + 36) //UUID's length is 36 per RFC4122
    Request.findOne({userRetrievalKey: userRetrievalKey}).populate('requester').populate('requestee').exec((err, request) => {
        if (err || !request ) {
            sendEmail(from, 'Shift Exchange Failed', 'Your email to ' + address + ' has been rejected. Please accept the shift online. <br><br> PayLoc Team')
            return res.error('An internal error occurred.', 500);
        }
        if (requestee[0].username.toLowerCase() !== from) {
            sendEmail(from, 'Shift Exchange Failed', 'Your email to ' + address + ' has been rejected. Please accept the shift online. <br><br> PayLoc Team')
            return res.error('An internal error occurred.', 500);
        }
        requestApproved(request)
        res.json({success: true})
    })
})

router.get('/manager/employees', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
    User.find({authorizedOrgs: req.session.auth.org._id}, (err, users) => {
        if (err) {
            return res.error('An internal error occurred.', 500);
        }
        var usersList = []
        users.forEach((user) => {
            var userCensored = {}
            userCensored.name = user.name
            userCensored.id = user._id
            usersList.push(userCensored)
        })
        res.json(usersList)
    })
})

router.post('/manager/shift', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
    const employeeIdsStr = req.body.employeeIds;
    const shiftCap = req.body.shiftCap;
    const note = escape(req.body.note);
    var recurrence = parseFloat(req.body.recurrence);
    const start = moment.tz(req.body.start, req.session.orgSettings.Timezone).utc();
    const end = moment.tz(req.body.end, req.session.orgSettings.Timezone).utc();
    console.log(start)
  console.log(end)

    if (employeeIdsStr === undefined) {
        return res.error('An internal error occurred.', 400);
    }
    const employeeIds = JSON.parse(employeeIdsStr);
    var userPromises = [];
    employeeIds.forEach((employeeId) => {
        userPromises.push(User.findOne({_id: employeeId, authorizedOrgs: req.session.auth.org._id}).exec());
    })
    Promise.all(userPromises).then(employees => {
        console.log('then');

        var shiftEmployees = [];
        employees.forEach((employee) => {
            shiftEmployees.push(employee._id)
        });
        var shifts = [];
        var until;
        const today = moment();
        if (recurrence == 0.5) {
            recurrence = 1
            console.log('recurrence = 0.5: true - daily triggered');
            const until = moment(req.body.until)
            const untilRoundedUp = moment(req.body.until).add(1, 'day')
            const days = Math.ceil(untilRoundedUp.diff(start, 'days'))
            start.subtract(recurrence, 'days')
            end.subtract(recurrence, 'days')
            for (var i = 0; i < days + recurrence; i = i + recurrence) {
                console.log('i: ' + i);
                const condition = {
                    orgId: req.session.auth.org._id,
                    startTime: start.add(recurrence, 'days').toDate(),
                    endTime: end.add(recurrence, 'days').toDate(),
                    employeeIds: shiftEmployees,
                    shiftCap: shiftCap,
                    note: note, // NOTE: NOTE
                    published: true,
                    dateCreated: today.toDate()
                }
                shifts.push(Shift.create(condition));
                console.log(condition)
            }
        } else if (recurrence > 0) {
            console.log('recurrence > 0: true');
            const until = moment(req.body.until)
            const untilRoundedDown = moment(req.body.until).subtract(recurrence / 2, 'weeks').add(0.5, 'day')
            const weeks = Math.ceil(untilRoundedDown.diff(start, 'week'))

            console.log('unceiled weeks: ' + until.diff(start, 'week'));
            console.log('weeks: ' + weeks);
            console.log('start: ' + start);
            console.log('recurrence: ' + recurrence);

            //start off with a negative time since there will be an extra recurrence added and we need to cover today
            start.subtract(recurrence, 'weeks')
            end.subtract(recurrence, 'weeks')

            //return
            for (var i = 0; i < weeks + recurrence; i = i + recurrence) {
                console.log('i: ' + i);
                const condition = {
                    orgId: req.session.auth.org._id,
                    startTime: start.add(recurrence, 'weeks').toDate(),
                    endTime: end.add(recurrence, 'weeks').toDate(),
                    employeeIds: shiftEmployees,
                    shiftCap: shiftCap,
                    note: note, // NOTE: NOTE
                    published: true,
                    dateCreated: today.toDate()
                }
                shifts.push(Shift.create(condition));
                console.log(condition)
            }
        } else {
            console.log('recurrence > 0: false');
            const condition = {
                orgId: req.session.auth.org._id,
                startTime: start.toDate(),
                endTime: end.toDate(),
                employeeIds: shiftEmployees,
                shiftCap: shiftCap,
                note: note, // NOTE: NOTE
                published: true,
                dateCreated: today.toDate()
            }
            shifts.push(Shift.create(condition));
        }
        Promise.all(shifts).then(shifts => {
            var childrenShiftIds = []
            shifts.forEach((shift) => {
                childrenShiftIds.push(shift._id)
            })
            ParentShift.create({
                orgId: req.session.auth.org._id,
                children: childrenShiftIds,
                dateCreated: today.toDate()
            })
            res.json({
                success: true
            })
        })
    });

})

router.post('/manager/shift/delete', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
    if (req.body.shift === undefined || req.body.shift == '') {
        return res.error('Please select a shift', 400);
    }
    Shift.findOne({_id: req.body.shift}, function(err, result) {

        if (err || result  === null ) {
          return res.error('An internal server error occurred', 404);
        } else if(result.deleteLock) {
            return res.error('This shift cannot be removed because it has an attendance record linked with it. Please contact PayLoc Support if you have questions. ', 400);
        } else {
          result.remove();
            return res.json({
                success: true
            })
        }
    });
    /**
     User.find({authorizedOrgs: req.session.auth.org._id}, (err, users) => {
    if (err) {
      return res.error('An internal error occurred.', 500);
    }
    var usersList = []
    users.forEach((user) => {
      var userCensored = {}
      userCensored.name = user.name
      userCensored.id = user._id
      usersList.push(userCensored)
    })
    res.json(usersList)
  })**/
});

router.get('/download', sessAuth.verifyLogin, (req, res, next) => {
  // render.page(req, res, 'downloadApp.html', 'downloadApp', 'Download Mobile Apps');
  return res.redirect("http://help.payloc.io/get-started/how-to-download-payloc-mobile-app");
});

router.post('/manager/shift/:id', sessAuth.verifyManagerLoginRedirect, async (req, res, next) => {
  try {

    const start = moment.tz(req.body.start, req.session.orgSettings.Timezone).utc();
    const end = moment.tz(req.body.end, req.session.orgSettings.Timezone).utc();
    if (!start || !end )
      res.error('Invalid request', 400);

    const shift = await Shift.findOne({
      orgId: req.session.auth.org._id,
      _id: mongoose.Types.ObjectId(req.params.id)
    }).exec();

    if (shift.deleteLock || moment.tz(shift.endTime, req.session.orgSettings.Timezone).utc().diff(moment().toDate()) < 0) {
      return res.json({
        revert: true,
        message: 'A past shift cannot be modified.'
      });
    }
    if (moment(start).diff(moment().toDate()) < 0) {
      // start time is in the past
      return res.error('Start date cannot be in the past', 400);
    }
    if (moment(start).diff(moment(end).toDate()) > 0) {
      // start time is in the past
      return res.error('End time cannot be earlier than start time', 400);
    }
    shift.startTime = start;
    shift.endTime = end;
    await shift.save();
    res.json({
      success: true
    })
  } catch (e) {
    if (config.dev)
      console.log(e);
    logger.error(e);
    res.error('Unable to modify this shift. Please try again. ', 500);
  }
});

async function predictWages(req, startPoint, endPoint) { // please pass in moment object, not raw js date
  const shifts = await Shift.find({
    endTime: {
      '$gte': startPoint.toDate(),
      '$lte': endPoint.toDate()
    },
    published: true,
    orgId: req.session.auth.org._id
  }).lean().populate('employeeIds').exec();

  let indivdualShiftAmountPromises = [];
  // console.log(shifts)
  await forEach(shifts, (shiftPassedIn) => {
    indivdualShiftAmountPromises.push((async (shift) => { // this should return $ in this shift (all employees accounted for).
      const shiftLength = moment(shift.endTime).diff(shift.startTime, 'minutes');  // In minutes, obviously.
      let amount = 0; // $ of Ls in this shift
      await forEach(shift.employeeIds, (employee) => {
        amount += employee.hourlyRate * (shiftLength / 60)
      });
      return amount;
    })(shiftPassedIn)) // a shift with an async function is pushed to an array. doing a promise.all later on the array.
  });
  const amount = parseFloat(_.sum(await Promise.all(indivdualShiftAmountPromises))).toFixed(2);
  return {
    success: true,
    shiftCount: shifts.length,
    amount: amount
  };
}

router.get('/manager/predict', sessAuth.verifyManagerLoginRedirect, async (req, res, next) => {
  // predict $ to be spent next week
  const startPoint = moment(req.query.start);
  const endPoint = moment(req.query.end);
  try {
    res.json(await predictWages(req, startPoint, endPoint));
  } catch (e) {
    if (config.dev)
      console.log(e);
    logger.error({
      err: e,
      session: req.session
    }, 'error predicting future wage expenses')
  }
});

function requestApproved(requestObj) {
    if (requestObj.approved) { //already executed previously
        //return true
    }

    requestObj.approved = true;
    requestObj.save();
    Shift.findOne({_id: requestObj.oldShift}, (err, oldShift) => {
        Shift.findOne({_id: requestObj.newShift}, (err, newShift) => {
            /** ---- START process old shift ---- **/
            console.log('REQUESTER: ' + requestObj.requester[0]);
            console.log('oldshift:' + oldShift.employeeIds);

          Settings.findOne({orgId: requestObj.requester[0].authorizedOrgs}, (err, orgSettings) => {
              const emailUser = requestObj.requester[0]
            const sparky = new SparkPost(config.sparkPostToken) //email client
            sparky.transmissions.send({
              options: {
                sandbox: false //do not set this to true - limited to 5 test emails for lifetime
              },
              content: {
                from: 'PayLoc <system@payloc.io>',
                subject: 'Shift Exchange Approved',
                html: '<html><body><p>Dear ' + emailUser.name + ', </p> \
                <p>Your shift exchange request sent to ' + requestObj.requestee[0].name + ' was approved. </p> \
                <p>Your new shift: ' + moment(oldShift.startTime).tz(orgSettings.Timezone).format('dddd, MMMM Do, YYYY, h:mm a') + ' to ' + moment(oldShift.endTime).tz(orgSettings.Timezone).format('h:mm a') + '. </p> <br>\
                <p>PayLoc</p> \
                </body></html>'
              },
              recipients: [
                {address: emailUser.username}
              ]
            })  // user.username
              .then(data => {
                return res.json({
                  message: 'The change will be made once ' + user.name + ' approves the change. '
                })
              })
              .catch(err => {
                console.log(err)
                return res.error('An internal error occurred.', 500);
              });
          })
          // the following run async

            for (var i = 0; i < oldShift.employeeIds.length; i++) {
                if(oldShift.employeeIds[i].toString() == requestObj.requester[0]._id.toString()) {
                    oldShift.employeeIds.splice(i, 1)
                }
            }
            /**
             console.log(oldShift.employeeIds.splice( oldShift.employeeIds.findIndex((employee) => {
        return employee.toString() == requestObj.requester[0].toString()
      }), 1))

             **/

            console.log('oldshift:' + oldShift);
            console.log('REQUESTEE: ' + requestObj.requestee[0]);
            //return
            oldShift.employeeIds.push(requestObj.requestee[0]._id)
            console.log('oldshift:' + typeof (oldShift.employeeIds));
            console.log('oldshift:' +  (oldShift.employeeIds));

            oldShift.save((err, oldShift) => {
                if (err){
                    console.log(err)
                    return false
                }
                /** ---- START process new shift ---- **/
                /**
                 newShift.employeeIds.splice( newShift.employeeIds.findIndex((employee) => {
          return employee.toString() == requestObj.requestee[0].toString()
        }), 1)
                 **/
                for (var i = 0; i < newShift.employeeIds.length; i++) {
                    if(newShift.employeeIds[i].toString() == requestObj.requestee[0]._id.toString()) {
                        newShift.employeeIds.splice(i, 1)
                    }
                }
                //delete newShift.employeeIds[requestObj.requestee[0]]
                newShift.employeeIds.push(requestObj.requester[0]._id)
                newShift.save((err) => {
                    if (err) {
                        console.log('ROLL BACK')
                        //roll back
                        oldShift.employeeIds.splice( oldShift.employeeIds.findIndex((employee) => {
                            return employee.toString() == requestObj.requestee[0].toString()
                        }), 1)
                        oldShift.employeeIds.push(requestObj.requester[0])
                        oldShift.save((err) => {
                            //roll back failed
                            return false
                        })
                    }
                    return true
                })
                /** ---- END process new shift ---- **/
            })
            /** ---- END process old shift ---- **/
        })
    })
}

function sendEmail(recipient, subject, body) { //for sending quick email without reliable callback
    const sparky = new SparkPost(config.sparkPostToken) //email client
    sparky.transmissions.send({
        options: {
            sandbox: false //do not set this to true - limited to 5 test emails for lifetime
        },
        content: {
            from: 'PayLoc <support@payloc.io>',
            subject: subject,
            html: body
        },
        recipients: [
            {address: recipient}
        ]
    })  // user.username
        .then(data => {
            return data
        })
        .catch(err => {
            return false
        });
}

module.exports = router

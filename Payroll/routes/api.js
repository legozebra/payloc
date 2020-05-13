const express = require('express'),
  router = express.Router(),
  Shift = require('../models/Shift.js'),
  UserPayout = require('../models/UserPayout.js'),
  Request = require('../models/Request.js'),
  User = require('../models/User.js'),
  Clock = require('../models/Clock.js'),
  request = require('request'),
  config = require('../config.json'),
  rp = require('request-promise'),
  mongoose = require('mongoose'),
  SparkPost = require('sparkpost'),
  uuidv4 = require('uuid/v4'),
  moment = require('moment-timezone'),
  _ = require('lodash'),
  sessAuth = require('../helpers/sessAuth'),
  logger = require('../helpers/logger'),
  Settings = require('../models/Settings'),
  Lob = require('lob')(config.lobKey),
  LobProd = require('lob')(config.lobProdKey),
  crypto = require('crypto'),
  geolib = require('geolib');

router.get('/redeem/', (req, res, next) => {
  const ticket = req.token;
  request(config.auth.authEndpoint + '/api/ticket/' + ticket + '/redeem', function (err, response, body) {
    body = JSON.parse(body);
    if (response.statusCode !== 200 || body.error === true) {
      return res.error(body.message, response.statusCode);
    }
    request(config.auth.authEndpoint + '/api/ticket/' + ticket + '/userInfo', function (err, response, userBody) {
      const user = JSON.parse(userBody);
      if (response.statusCode !== 200 || userBody.error === true) {
        return res.error(body.message, response.statusCode);
      }
      request(config.auth.authEndpoint + '/api/ticket/' + ticket + '/orgInfo', function (err, response, orgJSON) {
        const org = JSON.parse(orgJSON);
        if (response.statusCode !== 200 || orgJSON.error === true) {
          return res.error(body.message, response.statusCode);
        }
        const intercomhmac = crypto.createHmac('sha256', 'F-7wi43TCK82xsUeEyQxt4NDlxp158KSg8uCyARt');
        intercomhmac.update(String(JSON.parse(userBody)._id));
        const hmacstr = intercomhmac.digest('hex');

        res.json({
          success: true,
          name: String(JSON.parse(userBody).name),
          id: String(JSON.parse(userBody)._id),
          accessLevel: (JSON.parse(userBody).accessLevel),
          authToken: hmacstr,
          org: String(JSON.parse(orgJSON).name)
        })
      })
    })
  })
})

router.get('/clock/current', sessAuth.ticket, (req, res, next) => {
  const user = req.payloc.user;
  const org = req.payloc.org;
  Clock.findOne({
    orgId: org._id,
    completed: false,
    employeeId: mongoose.Types.ObjectId(user._id)
  }).populate('shift').then((clock) => {
    if (!clock) {
      return res.error('You are not clocked in right now. ', 400)
    }
    return res.json(clock)
  })
});

router.get('/shift/current', sessAuth.ticket, (req, res, next) => {
  const user = req.payloc.user;
  const org = req.payloc.org;
  // console.log( getNow(req))
  const conditions = {
    $and: [
      {
        "endTime": {
          $gt: getNow(req)
        }
      },
      {
        "startTime": {
          $lte: getNow(req)
        }
      }
    ],
    published: true,
    orgId: org._id,
    employeeIds: mongoose.Types.ObjectId(user._id),
  };
  Shift.findOne(conditions, (err, shift) => {
    if (err) {
      logger.error({err: err, req: req}, 'unable to pull shift from mongodb');
      return res.error('An internal error occurred. ', 500);
    }
    if (!shift) {
      return res.error('You do not have a shift right now. Check back later.', 401)
    }
    Clock.findOne({
      shift: shift._id,
      employeeId: user._id
    }, (err, result) => {
      if (err) {
        logger.error({err: err, req: req}, 'error while trying to pull up clock record based on shift - usually mongoose issue');
        return res.error("An internal server error has occurred. ", 500);
      }
      if (!result) {
        // no clock record - must be a new shift
        shift.deleteLock = undefined;
        return res.json({
          success: true,
          active: false,
          next: false,
          shift: shift
        })
      } else {
        // there is a clock record - check for completion
        if (result.completed) {
          // give the next shift info
          return res.json({
                  success: true,
                  active: false,
                  next: true
                })
          // getNextShift(getNow(req), user._id).then((result) => {
          //   if (result === false) {
          //     return res.error('You do not have a shift right now or you are currently in a shift. Check back later.', 401)
          //   } else {
          //     return res.json({
          //       success: true,
          //       active: false,
          //       next: true
          //     })
          //   }
          // })
        } else {
          // this guy is in the shift
          shift.deleteLock = undefined;
          return res.json({
            success: true,
            active: true,
            next: false,
            shift: shift
          })
        }
      }
    });
  })

})

async function getNextShift(isoDate, userId) {
  const result = await Shift.find({
    startTime: {$gte: isoDate},
    employeeIds: mongoose.Types.ObjectId(userId)
  }).sort({"startTime":1}).limit(1);
  if(result.length === 0 || moment().diff(moment(result[0].endTime)) > 0) {
    return false;
  } else {
    return result[0];
  }
}

router.get('/shift/next', sessAuth.ticket, (req, res, next) => {
  const isoDate = getNow(req);

  getNextShift(isoDate, req.payloc.user._id).then((result) => {
    if(result === false) {
      logger.info({
        req: req
      }, 'there are no more shift so success=false')
      return res.json({
        success: false
      })
    } else {
      return res.json({
        success: true,
        shift: result
      })
    }
  });
});

async function getLastShift(isoDate, userId) {
  const clocks = await Clock.find({completed: false}).limit(2);
  if(clocks.length === 0) {
    return false;
  } else {
    for (x = 0; x < clocks.length; x++) {
      const result = await Shift.find({_id: clocks[x].shift, endTime: {$lt: isoDate}, employeeIds: mongoose.Types.ObjectId(userId)}).sort({"endTime":-1}).limit(1);
      if (result.length === 0 || moment().diff(moment(result[0].endTime)) < 0) {
        continue
      } else {
        return result[0];
      }
    }
    return false;
  }
}

router.get('/shift/last', sessAuth.ticket, (req, res, next) => {
  const isoDate = getNow(req);

  getLastShift(isoDate, req.payloc.user._id).then((result) => {
    if(result === false) {
      logger.info({
        req: req
      }, 'there are no incomplete shifts so success=false')
      return res.json({
        success: false
      })
    } else {
      return res.json({
        success: true,
        shift: result
      })
    }
  });
})

router.post('/clock/in/:shiftId', sessAuth.ticket, (req, res, next) => {
  const user = req.payloc.user;
  const org = req.payloc.org;


  const shiftConditions = {
    $and: [
      {
        "endTime": {
          $gte: getNow(req)
        }
      },
      {
        "startTime": {
          $lte: getNow(req)
        }
      }
    ],
    published: true,
    orgId: org._id,
    employeeIds: mongoose.Types.ObjectId(user._id),
    _id: req.params.shiftId
  };
  Shift.findOne(shiftConditions, (err, shift) => {
    if (err || !shift ) {
      // console.log(err);
      if (err) {
        logger.error({req: req, err: err}, 'clock in mongodb error')
      }
      logger.warn({req: req, query: shiftConditions}, 'clock in request has an invalid shift id. ');
      return res.error('You do not have a shift right now or your clock in request has expired. Please try again. ', 400); //shift ID is not valid
    }
    shift.deleteLock = true;
    shift.save();
    Clock.findOne({
      orgId: org._id,
      $or: [
        {shift: shift._id},
        {completed: false}
      ],
      employeeId: mongoose.Types.ObjectId(user._id)
    }).populate('shift').then((clockExists) => {
      if (err || clockExists) {
        return res.json({
          error: true,
          outdated: true,
          message: 'You have already clocked in.',
          clockId: clockExists._id,
          startedAt: clockExists.startTime,
          shift: shift,
          clock: clockExists
        })
      }
      let gpsDistance = null;
      const body = req.body;
      if (req.payloc.settings.GPS !== null && req.payloc.settings.GPS.GPSEnforcement) {
        if (body.latitude === undefined && body.longitude === undefined) {
          logger.error({req: req, body: body}, 'invalid client clock in request - no gps data');
          return res.error('Your request is invalid. Please try again. ', 400);
        }
        const gpsLocation = req.payloc.settings.GPS.GPSLocation;
        gpsDistance = geolib.getDistance(
          {latitude: gpsLocation[1], longitude: gpsLocation[0]},
          {latitude: body.latitude, longitude: body.longitude},
          10, //10cm precision
          3
        );
        if (!(gpsDistance <= req.payloc.settings.GPS.GPSRadius + 50)) { //+50 cm for better user experience...
          logger.info({req: req, gpsRestriction: req.payloc.settings.GPS, gpsPassedIn: body, distance: gpsDistance}, 'clock in request denied due to geofencing restrictions');
          return res.error('You are not allowed to clock in at this location. Please enter your work environment before clocking in. ', 400);
        }
      }
      try {
        Clock.create(
          {
            orgId: org._id,
            shift: shift._id,
            employeeId: mongoose.Types.ObjectId(user._id),
            startTime: getNow(req),
            completed: false,
            distance: gpsDistance,
            gpsLocation: {latitude: body.latitude || null, longitude: body.longitude || null},
            violation: false,
            paid: false
          }, (err, clock) => {
            if (err) {
              logger.error({
                req: req,
                err: err,
                shift: shift
              }, 'unable to create a clock record for the shift');
              return res.error('An internal error occurred.', 500);
            }
            global.IntercomClient.events.create({
              event_name: 'Clocked In',
              created_at: Math.round((new Date()).getTime() / 1000),
              user_id: user._id,
              metadata: { clock: clock._id, shift: shift._id, distance: gpsDistance || null, latitude: body.latitude || null, longitude: body.longitude || null }
            });
            return res.json({
              success: true,
              clock: clock._id
            })
          })
      } catch (e) {
        if (config.dev) {
          console.log(e);
        }
        logger.error({
          req: req,
          err: err
        }, 'internal error when trying to clock in');
        return res.error('An internal error occurred.', 500);
      }

    })
  })
});


router.post('/clock/out/:shiftId', sessAuth.ticket, (req, res, next) => {
  const user = req.payloc.user;
  const org = req.payloc.org;
  let clockQuery = {};
  try {
    clockQuery = {
      shift: mongoose.Types.ObjectId(req.params.shiftId),
      orgId: org._id,
      employeeId: mongoose.Types.ObjectId(user._id)
    };
  } catch (err) {
    logger.warn({
      req: req,
      err: err,
      shiftId: req.params.shiftId
    }, 'the user passed in an invalid objectId for clock out. ');
    return res.error('Your request is invalid. Please try again. ', 400);
  }
  Clock.findOne(clockQuery, (err, clock) => {
    if (err || !clock) {
      logger.warn({
        req: req,
        err: err,
        query: clockQuery
      }, 'client try to clock out a shift that doesnt have a clock record linked. may indicate data corruption. ');
      return res.error('An internal error occurred.', 500);
    }
    if (clock.completed) {
      logger.warn({
        req: req,
        err: err,
        query: clockQuery
      }, 'client tried to clock out of a clock that is already been completed. may indicate mobile client frontend error. ');
      return res.error('You have already clocked out.', 400);
    }
    Shift.findById(req.params.shiftId, (err, shift) => {
      if (err || !shift) {
        logger.warn({
          req: req,
          err: err,
          clock: clock
        }, 'A clock record cannot be matched to a shift record. May indicate data corruption');
        return res.error('An internal error occurred.', 500);
      }
      let gpsDistance = null;
      const body = req.body;
      if (req.payloc.settings.GPS !== null && req.payloc.settings.GPS.GPSEnforcement) {
        if (body.latitude === undefined && body.longitude === undefined) {
          logger.error({req: req, body: body}, 'invalid client clock out request - no gps data');
          return res.error('Your request is invalid. Please try again. ', 400);
        }
        const gpsLocation = req.payloc.settings.GPS.GPSLocation;
        gpsDistance = geolib.getDistance(
          {latitude: gpsLocation[1], longitude: gpsLocation[0]},
          {latitude: body.latitude, longitude: body.longitude},
          10, //10cm precision
          3
        );
        if (!(gpsDistance <= req.payloc.settings.GPS.GPSRadius + 50)) { //+50 cm for better user experience...
          logger.info({req: req, gpsRestriction: req.payloc.settings.GPS, gpsPassedIn: body, distance: gpsDistance}, 'clock out request denied due to geofencing restrictions');
          return res.error('You are not allowed to clock out at this location. Please enter your work environment before clocking out. ', 400);
        }
      }
      clock.completed = true
      clock.endTime = getNow(req)
      const overTime = moment(shift.endTime).diff(getNow(req), 'minutes') * -1
      clock.violationValue = overTime
      // console.log('shift.endTime: ' + shift.endTime);
      // console.log('overTime: ' + overTime)
      //res.end('')
      if (overTime > 1) {
        //over tolorance level
        clock.violation = true
        clock.violationType = 'OVERTIME'
        clock.violationDescription = user.name + ' worked overtime for ' + overTime + ' minutes.'
      }
      let x, breakID;
      let isActive = false;
      for (x = 0; x < clock.breaks.length; x++) {
        if (clock.breaks[x].endTime == null) {
          clock.breaks[x].endTime = getNow(req);
          breakID = clock.breaks[x]._id;
          isActive = true;
        }
      }
      clock.save((err) => {
        if (err) {
          logger.error({
            req: req,
            err: err,
            clock: clock,
            shift: shift
          }, 'A clock record cannot be matched to a shift record. May indicate data corruption');
          return res.error('An internal error occurred.', 500);
        }
        if (isActive) {
          global.IntercomClient.events.create({
            event_name: 'Break Ended',
            created_at: Math.round((new Date()).getTime() / 1000),
            user_id: user._id,
            metadata: { shift: clock.shift._id, org_id: org._id, clock: clock._id, break: breakID}
          });
        }
        global.IntercomClient.events.create({
          event_name: 'Clocked Out',
          created_at: Math.round((new Date()).getTime() / 1000),
          user_id: user._id,
          metadata: { shift: clock.shift._id, org_id: org._id, clock: clock._id}
        });
        if (clock.violation) {
          User.find({accessLevel: 0, authorizedOrgs: org._id}, (err, admins) => {
            // console.log(admins);
            var adminEmails = [];
            admins.forEach((admin) => {
              adminEmails.push({address: admin.username, name: admin.name})
            });
            sendEmailGroup(adminEmails, 'Compliance Alert', 'Dear ' + org.name + ', <br>\
                <p>We have recently detected a compliance issue with your timecard record. Please find the details attached below. </p>  \
                <p>' + clock.violationType + ': ' + clock.violationDescription + ' <br> \
                   Affected shift: ' + moment(shift.startTime).tz(req.payloc.settings.Timezone).format('dddd, MMMM Do, YYYY, h:mm a') + ' to ' + moment(shift.endTime).tz(req.payloc.settings.Timezone).format('dddd, MMMM Do, YYYY, h:mm a') + ' \
                </p> \
                <br> \
                <p>PayLoc <br><i>On behalf of ' + org.name + '</i></p> \
                </body></html>')
          })
          global.IntercomClient.events.create({
            event_name: 'Overtime',
            created_at: Math.round((new Date()).getTime() / 1000),
            user_id: user._id,
            metadata: { shift: clock.shift._id, org_id: org._id, clock: clock._id, violationType: clock.violationType, violationDescription: clock.violationDescription}
          });
        }
        return res.json({
          success: true,
          violation: clock.violation
        })
      })
    })
  })
});

router.post('/break/start/:shiftId', sessAuth.ticket, async (req, res, next) => {
  const user = req.payloc.user;
  const org = req.payloc.org;
  let clockQuery = {};
  try {
    clockQuery = {
      shift: mongoose.Types.ObjectId(req.params.shiftId),
      orgId: org._id,
      employeeId: mongoose.Types.ObjectId(user._id)
    };
  } catch (err) {
    logger.warn({
      req: req,
      err: err,
      shiftId: req.params.shiftId
    }, 'the user passed in an invalid objectId for starting a break. ');
    return res.error('Your request is invalid. Please try again. ', 400);
  }
  try {
    const clock = await Clock.findOne(clockQuery).exec();
    if (clock.completed) {
      logger.warn({
        req: req,
        err: err,
        query: clockQuery
      }, 'client tried to start a break for of a clock that is already been completed. May indicate mobile client frontend error. ');
      return res.error('You have already clocked out.', 400);
    }
    let x;
    for (x = 0; x < clock.breaks.length; x++) {
      if (clock.breaks[x].endTime == null) {
        return res.error('There is a break currently active.', 400);
      }
    }
    let gpsDistance = null;
    const body = req.body;
    if (req.payloc.settings.GPS !== null && req.payloc.settings.GPS.GPSEnforcement) {
      if (body.latitude === undefined && body.longitude === undefined) {
        logger.error({req: req, body: body}, 'invalid client break start request - no gps data');
        return res.error('Your request is invalid. Please try again. ', 400);
      }
      const gpsLocation = req.payloc.settings.GPS.GPSLocation;
      gpsDistance = geolib.getDistance(
        {latitude: gpsLocation[1], longitude: gpsLocation[0]},
        {latitude: body.latitude, longitude: body.longitude},
        10, //10cm precision
        3
      );
      if (!(gpsDistance <= req.payloc.settings.GPS.GPSRadius + 50)) { //+50 cm for better user experience...
        logger.info({req: req, gpsRestriction: req.payloc.settings.GPS, gpsPassedIn: body, distance: gpsDistance}, 'break start request denied due to geofencing restrictions');
        return res.error('You are not allowed to start a break from this location. Please enter your work environment before starting your break. ', 400);
      }
    }
    let brk = {
      startTime: getNow(req),
      endTime: null
    }
    clock.breaks.push(brk);
    await clock.save((err) => {
      if (err) {
        logger.error({
          req: req,
          err: err,
          query: clockQuery
        }, 'internal error when trying to start a break');
        return res.error('An internal error occurred.', 500);
      }
      global.IntercomClient.events.create({
        event_name: 'Break Started',
        created_at: Math.round((new Date()).getTime() / 1000),
        user_id: user._id,
        metadata: { shift: clock.shift._id, org_id: org._id, clock: clock._id, break: clock.breaks[x]._id}
      });
      return res.json({
        success: true,
        violation: false
      })
    })
  } catch (err) {
    logger.error({
      req: req,
      err: err,
      query: clockQuery
    }, 'internal error when trying to start a break');
    return res.error('An internal error occurred.', 500);
  }
});

router.post('/break/end/:shiftId', sessAuth.ticket, async (req, res, next) => {
  const user = req.payloc.user;
  const org = req.payloc.org;
  let clockQuery = {};
  try {
    clockQuery = {
      shift: mongoose.Types.ObjectId(req.params.shiftId),
      orgId: org._id,
      employeeId: mongoose.Types.ObjectId(user._id)
    };
  } catch (err) {
    logger.warn({
      req: req,
      err: err,
      shiftId: req.params.shiftId
    }, 'the user passed in an invalid objectId for ending a break. ');
    return res.error('Your request is invalid. Please try again. ', 400);
  }
  try {
    const clock = await Clock.findOne(clockQuery).exec();
    if (clock.completed) {
      logger.warn({
        req: req,
        err: err,
        query: clockQuery
      }, 'client tried to end a break for of a clock that is already been completed. May indicate mobile client frontend error. ');
      return res.error('You have already clocked out.', 400);
    }
    let gpsDistance = null;
    const body = req.body;
    if (req.payloc.settings.GPS !== null && req.payloc.settings.GPS.GPSEnforcement) {
      if (body.latitude === undefined && body.longitude === undefined) {
        logger.error({req: req, body: body}, 'invalid client break end request - no gps data');
        return res.error('Your request is invalid. Please try again. ', 400);
      }
      const gpsLocation = req.payloc.settings.GPS.GPSLocation;
      gpsDistance = geolib.getDistance(
        {latitude: gpsLocation[1], longitude: gpsLocation[0]},
        {latitude: body.latitude, longitude: body.longitude},
        10, //10cm precision
        3
      );
      if (!(gpsDistance <= req.payloc.settings.GPS.GPSRadius + 50)) { //+50 cm for better user experience...
        logger.info({req: req, gpsRestriction: req.payloc.settings.GPS, gpsPassedIn: body, distance: gpsDistance}, 'break end request denied due to geofencing restrictions');
        return res.error('You are not allowed to end a break from this location. Please enter your work environment before ending your break. ', 400);
      }
    }
    let x, breakID;
    let isActive = false;
    for (x = 0; x < clock.breaks.length; x++) {
      if (clock.breaks[x].endTime == null) {
        clock.breaks[x].endTime = getNow(req);
        breakID = clock.breaks[x]._id;
        isActive = true;
      }
    }
    if (!isActive || clock.breaks.length == 0) {
      return res.error('No break currently active.', 400);
    } else {
      await clock.save((err) => {
        if (err) {
          return res.error('An internal error occurred.', 500);
        }
        global.IntercomClient.events.create({
          event_name: 'Break Ended',
          created_at: Math.round((new Date()).getTime() / 1000),
          user_id: user._id,
          metadata: { shift: clock.shift._id, org_id: org._id, clock: clock._id, break: breakID}
        });
        return res.json({
          success: true,
          violation: false
        })
      })
    }
  } catch (err) {
    logger.error({
      req: req,
      err: err,
      query: clockQuery
    }, 'internal error when trying to end a break');
    return res.error('An internal error occurred.', 500);
  }
});

router.get('/configuration', sessAuth.ticket, (req, res, next) => {
  let returnObject = {
    orgName: req.payloc.org.name,
    userName: req.payloc.user.name,
    accessLevel: req.payloc.user.accessLevel
  };
  try {
    const result = req.payloc.settings;
    if (result.GPS === null || result.GPS === undefined || result.GPS.GPSLocation.length === 0) {
      returnObject.GPS = {
        setup: false
      };
    } else {
      const GPSInfo = result.GPS;
      const coordinates = {lat: GPSInfo.GPSLocation[1], lng: GPSInfo.GPSLocation[0]};
      returnObject.GPS = {
        success: true,
        setup: true,
        coordinates: coordinates,
        radius: GPSInfo.GPSRadius,
        enforced: GPSInfo.GPSEnforcement
      }
    }
    res.status(200).json(returnObject)
  } catch (err) {
    logger.error({
      req: req
    }, 'req.payloc global variable is not defined. ')
    return res.error('An internal server error has occurred. ', 500);
  }
    // if (err) {
    //   return res.error('An server error occurred. Please try again later. ', 500);
    // }


});

router.post('/payout/address', sessAuth.ticket, (req, res, next) => {
  //weird variable names used on purpose so people couldn't google the name of our provider hehe
  const addrIntId = uuidv4();
  LobProd.usVerifications.verify({
    primary_line: req.body.primary_line,
    secondary_line: req.body.secondary_line,
    zip_code: req.body.zip_code
  }, function (err, addrVerified) {
    //console.log (err, res);
    if (err) {
      logger.info({
        err: err,
        user: req.payloc
      }, 'user address validation error');
      if (config.dev)
        console.log(err);
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
      description: req.payloc.org.name + '-' + req.payloc.user.name,
      name: req.payloc.user.name,
      email: req.payloc.user.username,
      address_line1: addrVerified.primary_line,
      address_line2: addrVerified.secondary_line,
      address_city: addrVerified.components.city,
      address_state: addrVerified.components.state,
      address_zip: addrVerified.components.zip_code + '-' + addrVerified.components.zip_code_plus_4,
      address_country: 'US',
      metadata: {
        orgId: req.payloc.org._id.toString(),
        type: 'UserPayout',
        employeeId: req.payloc.user._id.toString(),
        addrIntId: addrIntId
      }
    },  (err, addr) => {
      if (err) {
        return res.error('An internal error occurred.', 500);
      }
      UserPayout.remove({
        orgId: req.payloc.org._id,
        user: req.payloc.user._id
      }, () => {
        UserPayout.create({
          orgId: req.payloc.org._id,
          user: req.payloc.user._id,
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


function sendEmailGroup(recipient, subject, body) { //for sending quick email without reliable callback
  const sparky = new SparkPost(config.sparkPostToken); //email client
  sparky.transmissions.send({
    options: {
      sandbox: false //do not set this to true - limited to 5 test emails for lifetime
    },
    content: {
      from: 'PayLoc <support@payloc.io>',
      subject: subject,
      html: body
    },
    recipients: recipient
  })  // user.username
    .then(data => {
      return data
    })
    .catch(err => {
      return false
    });
}

function getUTC() {
  const localDate = new Date(Date.now());
  return new Date(localDate.getUTCFullYear(), localDate.getUTCMonth(), localDate.getUTCDate(),
    localDate.getUTCHours(), localDate.getUTCMinutes(), localDate.getUTCSeconds());
}

function getNow(req) {
  // return moment().tz(req.payloc.settings.Timezone);
  return moment();
}

module.exports = router;

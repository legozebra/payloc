const express = require('express'),
  router = express.Router(),
  config = require('../../config.json'),
  sessAuth = require('../../helpers/sessAuth'),
  Settings = require('../../models/Settings'),
  render = require('../../helpers/render');

router.get('/', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
  let GPSSetup = true;
  Settings.findOne({orgId: req.session.auth.org._id}, (err, result) => {
    let timezone = '';
    if (err || result === null) {
      GPSSetup = false
    } else {
      if (result.GPS === null || result.GPS === undefined || result.GPS.GPSLocation.length === 0) {
        GPSSetup = false
      }
      timezone = result.Timezone
    }
    let GPSInfo = null;
    let GPSEnforcementChecked = '';
    if (GPSSetup) {
      GPSInfo = result.GPS
      if (GPSInfo.GPSEnforcement === true) {
        GPSEnforcementChecked = ' checked="checked"'
      }
    }

    render.page(req, res, 'attendanceSettings.html', 'attendance', 'Attendance Settings', {
      googleMapsKey: "AIzaSyAPepb3ltYs7B9LUlDogYW3RIcUxwEfJrM",
      GPSSetup: GPSSetup,
      GPSInfo: JSON.stringify(GPSInfo),
      timezone: timezone,
      GPSEnforcementChecked: GPSEnforcementChecked})
  })
});

router.post('/', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
  console.log(req.body)
  if(req.body.enforced === null) {
    return res.error('Your request is invalid. Please try again. ', 400);
  }
  req.body.GPSInfo = JSON.parse(req.body.GPS)
  if (req.body.GPSInfo === null && req.body.GPSEnforcement === true) {
    return res.error('Please specify your geofencing location before enabling enforcing geofencing clock in. ', 400);
  }
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  Settings.findOneAndUpdate({orgId: req.session.auth.org._id}, {
    GPS: {
      GPSEnforcement: req.body.enforced,
      GPSLocationName: req.body.GPSInfo.locationName,
      GPSLocation: [req.body.GPSInfo.longitude, req.body.GPSInfo.latitude],
      GPSRadius: req.body.GPSInfo.radius
    }
  }, options, (err, result) => {
    if (err) {
      return res.error('An server error occurred. Please try again later. ', 500);
    }
    res.json({
      success: true
    })
  });
});

module.exports = router;
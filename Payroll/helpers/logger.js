'use strict';

const bunyan = require('bunyan');
const config = require('../config.json');
const _ = require('lodash');
const sentryStream = require('bunyan-sentry-stream');
const Raven = require('raven');
const bunyanTransport = require('bunyan-transport');
const le_node = require('le_node');
const loggerDefinition = le_node.bunyanStream({ token: '14c5b25a-d608-4bef-b01c-069d1d9f7ffa' });

const logger = bunyan.createLogger({
  name: 'scheduler',
  serializers: {
    req: reqSerializer,
    err: errSerializer
  },
  streams: [
    loggerDefinition
  ]
});

function errSerializer(err) {
  return err;
}

function reqSerializer(req) {
  let errObj = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    session: req.session,
    correlationID: req.correlationID,
    dev: config.dev
  };
  if (req.session) {
    if (req.session.auth && req.session.auth.user && req.session.auth.user._id) {
      _.merge(errObj, {
        userId: req.session.auth.user._id,
        orgId: req.session.auth.user.authorizedOrgs
      })
    }
    if (req.headers.authorization) {
      _.merge(errObj, {
        auth: 'bearer'
      })
    } else {
      _.merge(errObj, {
        auth: 'cookie'
      })
    }
  }
  return errObj;
}

if (config.dev) {
  logger.addStream({
    name: "debugFileStream",
    path: './debug.log',
    level: 0
  });

}

module.exports = logger;
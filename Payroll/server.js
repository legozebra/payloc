'use strict'

const express = require('express'),
app = express(),
mongoose = require('mongoose'),
ejs = require('ejs'),
session = require('express-session'),
MongoStore = require('connect-mongo')(session),
bodyparser = require('body-parser'),
compression = require('compression'),
crypto = require('crypto'),
fs = require('fs'),
error = require('./helpers/error'),
mongooseDB = require('./db'),
bearerToken = require('express-bearer-token'),
  raven = require('raven'),
  Intercom = require('intercom-client'),
  ua = require("universal-analytics"),
  uuidv4 = require('uuid/v4'),
  figlet = require('figlet'),
  config = require('./config.json');

figlet('PayLoc', function(err, data) {
  if (err) {
    console.log('PayLoc');
  }
  console.log(data);
  figlet('Scheduler', function(err, data) {
    if (err) {
      console.log('Scheduler');
    }
    console.log(data)
  });
});

console.log('PayLoc Scheduler Module Server');
if (config.dev) {
  console.log("Development Server")
} else {
  console.log("PRODUCTION SERVER")
}
console.log('(C) PayLoc Corporation');
console.log('All Rights Reserved');


// speaking of error...
const Raven = require('raven');

global.ravenClient = Raven.config('https://a26ac7966b8a42e2b68d3940a6e9a20e:6a9eb394e8b5462abe609dcad7faccb7@sentry.io/243810', {
  release: require('git-rev-sync').long(),
  tags: {prod: !config.dev},
  shouldSendCallback: function (data) {
    return true;
  },
  parseUser: function (req) {
    // custom user parsing logic
    return req.session;
  }
}).install();

global.IntercomClient = new Intercom.Client({token: "dG9rOjVmYzMxM2Y2XzU4MzVfNDE1Ml85Y2ZkX2Q0MTMyNmJiZTRlYToxOjA="});

const logger = require('./helpers/logger');

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.engine('html', ejs.renderFile);

var connectionString = '';
if (config.dev || config.database.PROD_connectionString === '') {
  connectionString = `mongodb://${(config.database.auth && config.database.auth.enabled) ? config.database.auth.username + ":" + config.database.auth.password + "@" : "" }${config.database.address}:${config.database.port}/${config.database.databaseName}`
} else {
  connectionString = config.database.PROD_connectionString
  console.log('CONNECTION STRING PROVIDED')
}

app.use(session({
  secret: config.userSalt,
  cookie: { secure: false, httpOnly: true, sameSite: true},
  store: new MongoStore({
    stringify: false,
    collection: 'sessionsScheduler',
    ttl: 24 * 60 * 60, //1day
    mongooseConnection: mongoose.connection
  }),
  resave: false,
  saveUninitialized: true,
}))

app.use(compression());
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: false }));
app.use(error);
app.use((req, res, next) => {
  req.correlationID = uuidv4();
  res.correlationID = req.correlationID;
  next();
});
app.use((err, req, res, next) => {
  logger.error({err: err, req: req});
  res.end('Internal Server Error')
});

app.use(ua.middleware("UA-110059284-2", {cookieName: '_ga'}));

app.use((req, res, next) => {
  if (req.path.indexOf('.map') !== -1)
  {
    if (!config.dev && req.header('X-Sentry-Token') !== '39631c7b-46e5-4045-af89-a1f9e93d6b78') {
      throw new Error('Access denied for accessing sourcemap. Please use a developer credential. ')
    } else {
      next();
    }
  } else {
    next();
  }

});
app.use(express.static('static'));
app.use(bearerToken());


const main = require('./routes/main');
const login = require('./routes/login');
const schedule = require('./routes/schedule');
const api = require('./routes/api');
const settings = require('./routes/settings/index');
const payroll = require('./routes/payroll');
// const attendanceSettings = require('./routes/settings/attendanceSettings');

app.use('/status', (req, res, next) => {
  res.end('success')
});
app.use('/', main);
app.use('/login', login);
app.use('/scheduler', schedule);
app.use('/api', api);
// app.use('/settings/attendance', attendanceSettings);
app.use('/settings', settings);
app.use('/payroll', payroll);
// app.use('/settings/users', require('./routes/settings/users'));
// app.use('/settings/chat', require('./routes/settings/chat'));

let port = 1337;
if (config.dev) {
  port = config.portInDev + 1000;
  console.log(`Notice: HTTP requests are proxied through webpack. Webpack is listening on ${port}. `);
  console.log("Development server port:" & port);
} else {
  port = process.env.PORT || 1337;
  console.log("Production server port:" & port);
}
app.listen(port, (err) => {
  if (err) throw err
  console.log(`Listening on port ${port}.`)
});

process.env.PORT_IN_USE = port;

app.use(Raven.requestHandler());
app.use(Raven.errorHandler());

module.exports = app; // For Mocha requests to be done locally.
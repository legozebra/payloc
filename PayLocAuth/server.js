'use strict'

const express = require('express'),
app = express(),
mongoose = require('mongoose'),
ejs = require('ejs'),
helmet = require('helmet'),
session = require('express-session'),
MongoStore = require('connect-mongo')(session),
bodyparser = require('body-parser'),
  fileUpload = require('express-fileUpload'),
compression = require('compression'),
crypto = require('crypto'),
fs = require('fs'),
error = require('./helpers/error'),
config = require('./config.json'),
mongooseDB = require('./db'),
redirectToHTTPS = require('express-http-to-https').redirectToHTTPS,
figlet = require('figlet');


figlet('PayLoc', function(err, data) {
    if (err) {
        console.log('PayLoc');;
    }
    console.log(data)
});

console.log('PayLoc RESTful API server')
if (config.dev) {
  console.log("Development Server")
} else {
  console.log("PRODUCTION SERVER")
}
console.log('(C) PayLoc Inc All Rights Reserved')

const main = require('./routes/main')
const login = require('./routes/login')
const api = require('./routes/api')
const signup = require('./routes/signup')
const admin = require('./routes/admin')
const sso = require('./routes/sso')

app.disable('x-powered-by');
app.use(helmet())
app.set('view engine', 'ejs')
app.engine('html', ejs.renderFile)

var connectionString = ''
if (config.dev || config.database.PROD_connectionString == '') {
  connectionString = `mongodb://${(config.database.auth && config.database.auth.enabled) ? config.database.auth.username + ":" + config.database.auth.password + "@" : "" }${config.database.address}:${config.database.port}/${config.database.databaseName}`
} else {
  connectionString = config.database.PROD_connectionString
  console.log('CONNECTION STRING PROVIDED')
}
app.use(session({
  secret: config.userSalt,
  cookie: { secure: false, httpOnly: true, sameSite: true },
  store: new MongoStore({
    url: connectionString
  }),
  resave: false,
  saveUninitialized: true,
}))

app.use(compression())
app.use(bodyparser.urlencoded({ extended: false }))
app.use(error)
app.use((err, req, res, next) => {
  console.log(err)
  res.end('Internal Server Error')

  //res.error(err, 500)
})
app.use(express.static('static'));
app.use(fileUpload());


app.use('/', main)
app.use('/login', login)
app.use('/signup', signup)
app.use('/api', api)
app.use('/admin', admin)
app.use('/sso', sso)
app.use('/forgot', require('./routes/forgot'))
app.use('/logout', (req, res, next) => {
  req.session.destroy();
  res.redirect('https://payloc.io')
});
app.use('/intranet', (req, res, next) => {
  res.redirect('/.auth/login/aad')
});

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

const mongoose = require('mongoose')
const config = require('./config.json')

mongoose.Promise = global.Promise

const connectionURI = `mongodb://${(config.database.auth && config.database.auth.enabled) ? config.database.auth.username + ":" + config.database.auth.password + "@" : "" }${config.database.address}:${config.database.port}/${config.database.databaseName}`

if(config.dev === false || config.database.address === "PROD_connectionString"){
  console.log('Connecting to external database... ')
  mongoose.connect(config.database.PROD_connectionString)
} else {
  mongoose.connect(connectionURI)
}

const db = mongoose.connection

db.on('error', (err) => {
  console.log(err)
  console.error('MongoDB connection error')
  process.exit(1)
})

db.once('open', () => {
  // mongoose.set('debug', true)
})

module.exports = mongoose

//const mongoose = require('../db')
const mongoose = require('mongoose')
const appSchema = mongoose.Schema({
    appID: {
      type: String,
      required: true,
      index: { unique: true }
    },
    appSecret: {
      type: String,
      required: true
    },
    appDescription: {
      type: String,
      required: true
    },
    productId: {
      type: String,
      required: false
    }
})

const App = mongoose.model('App', appSchema)

module.exports = App

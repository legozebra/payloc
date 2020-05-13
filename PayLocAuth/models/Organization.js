//const mongoose = require('../db')
const mongoose = require('mongoose')

const organizationSchema = mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    authorizedUsers: {
      type: [String],
      required: true,
    },
    billingCustomerId: {
      type: String,
      required: false,
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false,
      required: true
    },
    timezone: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: false
    },
    dateCreated: {type: Date}
})

const Organization = mongoose.model('Organization', organizationSchema)

module.exports = Organization

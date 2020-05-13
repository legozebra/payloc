//const mongoose = require('../db')
const mongoose = require('mongoose')

const ticketSchema = mongoose.Schema({
    ticket: {
      type: String,
      required: true
    },
    entitlement: {
      type: Object,
      required: true
    },
    expiration: {
      type: String,
      required: true
    },
    signature: {
      type: String
    },
    redeemed: {
      type: Boolean,
      default: false,
      required: true
    },
    dateCreated: {type: Date}
})

const Ticket = mongoose.model('Ticket', ticketSchema)

module.exports = Ticket

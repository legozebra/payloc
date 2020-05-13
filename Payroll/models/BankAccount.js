const mongoose = require('mongoose')

const bankAccountSchema = mongoose.Schema({
  orgId: {
    type: String,
    required: true
  },
  bankObject: {
    description: String,
    metadata: {},
    routing_number: String,
    account_number: String,
    account_type: String,
    signatory: String
  },
  lobBankObject: Object,
  disabled: {type: Boolean, default: false},
  dateCreated: {type: Date}

})

const BankAccount = mongoose.model('BankAccount', bankAccountSchema)

module.exports = BankAccount

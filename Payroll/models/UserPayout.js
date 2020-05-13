const mongoose = require('mongoose')

const userPayoutSchema = mongoose.Schema({
  orgId: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  preferredPayoutMethod: String,
  addressObj: Object,
  addrIntId: String,
  stripeAccountId: String
})
/**
preferredPayoutMethod:
stripe
check
**/

module.exports = mongoose.model('UserPayout', userPayoutSchema)

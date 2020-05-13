const mongoose = require('mongoose')

const orgPayoutSchema = mongoose.Schema({
  orgId: {
    type: String,
    required: true
  },
  addressObj: Object,
  addrIntId: String,
  stripeAccountId: String,
  stripeAccountObject: Object, // this should not be trusted or disclosed to the client.
  enabled: {
    type: Boolean,
    default: true
  },
  rejected: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    default: 'new' // see https://stripe.com/docs/api#customer_bank_account_object
  }
});

module.exports = mongoose.model('OrgPayout', orgPayoutSchema);

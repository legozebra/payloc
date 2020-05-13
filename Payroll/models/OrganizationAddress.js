const mongoose = require('mongoose')

const organizationAddressSchema = mongoose.Schema({
  orgId: {
    type: String,
    required: true
  },
  lobAddressObject: {type: Object, required: true},
  disabled: {type: Boolean, default: false},
  dateCreated: {type: Date}

})

const OrganizationAddress = mongoose.model('OrganizationAddress', organizationAddressSchema)

module.exports = OrganizationAddress

//const mongoose = require('../db')
const mongoose = require('mongoose')

const rolesSchema = mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    deletable: {
      type: Boolean,
      required: true
    },
    permissionIds: {
      type: [String],
      required: true
    },
    organizationId: {
      type: String,
      required: true
    }
})

const Role = mongoose.model('Role', rolesSchema)

module.exports = Role

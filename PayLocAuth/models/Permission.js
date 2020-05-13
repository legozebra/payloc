//const mongoose = require('../db')
const mongoose = require('mongoose')

const permissionSchema = mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    componentName: {
      type: String,
      required: true
    },
    twoFactor: {
      type: Boolean,
      required: true
      default: false
    }
})

const Permission = mongoose.model('Permission', permissionSchema)

module.exports = Permission

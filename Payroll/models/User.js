//const mongoose = require('../db')
const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    password: {
      type: String,
      required: true
    },
    authorizedOrgs: {
      type: String,
    },
    dateCreated: {type: Date},
    accessLevel: Number,
    hourlyRate: {type: Number, required: true},
    changePasswordEnforced: {
      type: Boolean,
      default: false
    },
    creationChannel: String,
    taxWithholding: {
      flatRate: Number,
      percentage: Number
    }
})
 /**
accessLevel
0: Administrator
99: User
 **/
const User = mongoose.model('User', userSchema)

module.exports = User

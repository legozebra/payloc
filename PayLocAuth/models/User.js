//const mongoose = require('../db')
const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true,
      unique: true
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
    hourlyRate: {type: Number, required: false},
    changePasswordEnforced: {
      type: Boolean,
      default: false
    },
    creationChannel: String,
    taxWithholding: {
      flatRate: Number,
      percentage: Number
    },
    phone: {
      type: String,
      required: false
    }
})
 /**
accessLevel
0: Administrator
99: User
 **/
const User = mongoose.model('User', userSchema)

module.exports = User

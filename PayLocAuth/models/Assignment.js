//const mongoose = require('../db')
const mongoose = require('mongoose')


const assignmentsSchema = mongoose.Schema({
    personId: {
      type: String,
      required: true
    },
    roleId: {
      type: String,
      required: true
    },
    assignedBy: {
      type: String,
      required: true
    },
    dateCreated: {type: Date}
})

const Assignment = mongoose.model('Assignment', assignmentsSchema)

module.exports = Assignment

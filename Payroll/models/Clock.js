/**
Associated with a shift
For personal employee
**/

const mongoose = require('mongoose');

const breakSchema = mongoose.Schema({
  startTime: 'Date',
  endTime: 'Date'
})

const clockSchema = mongoose.Schema({
  orgId: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: false
  },
  shift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  },
  breaks: [breakSchema],
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  payRecord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayRecord'
  },
  distance: Number,
  GPSLocation: Object,
  completed: Boolean,
  violation: Boolean,
  violationType: String,
  violationDescription: String,
  violationValue: Number,
  paid: Boolean

})

module.exports = mongoose.model('Clock', clockSchema)

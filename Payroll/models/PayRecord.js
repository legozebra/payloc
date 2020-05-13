const mongoose = require('mongoose');

const payItemSchema = mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  },
  clockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clock'
  },
  workedMinutes: {
    type: Number
  }
});

const payRecordSchema = mongoose.Schema({
  orgId: {
    type: String,
    required: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  payId: {
    type: String,
    unique: true,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  target: String,
  type: String, //lob or stripe
  paymentInfo: Object,
  items: [payItemSchema], // items paid in this record
  date: {
    type: Date,
    default: new Date()
  }
});

module.exports = mongoose.model('PayRecord', payRecordSchema)

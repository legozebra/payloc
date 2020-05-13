const mongoose = require('mongoose')

const requestSchema = mongoose.Schema({
  orgId: {
    type: String,
    required: true
  },
  oldShift: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shift' }],
  newShift: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shift' }],
  requester: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  requestee: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  userRetrievalKey: String,
  approved: Boolean
})

module.exports = mongoose.model('Request', requestSchema)

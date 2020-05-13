const mongoose = require('mongoose')

const parentSchema = mongoose.Schema({
  orgId: {
    type: String,
    required: true
  },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shift' }],
  dateCreated: Date
})

module.exports = mongoose.model('ParentShift', parentSchema)

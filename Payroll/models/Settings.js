const mongoose = require('mongoose')

const settingsSchema = mongoose.Schema({
  orgId: {
      type: String,
      required: true
  },
  OT_Tolorance: {
    type: Number,
    default: 2
  },
  Timezone: {
    type: String,
    required: true
  },
  GPS: {
    GPSLocation: {type: [Number], index: {type: '2dsphere', sparse: true}},
    GPSLocationName: {
      type: Boolean,
      required: false
    },
    GPSRadius: {
      type: Number,
      required: false
    },
    GPSEnforcement: {
      type: Boolean,
      default: false
    }
  },
  testmode: {        // All payments go through test environment
    type: Boolean,
    default: false
  },
  oneAddressMode: {  // All payment checks go to one address
    type: Boolean,
    default: false
  },
});

module.exports = mongoose.model('Settings', settingsSchema)

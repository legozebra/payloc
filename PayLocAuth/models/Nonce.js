const mongoose = require('mongoose')

const nonceSchema = mongoose.Schema({
    nonce: {
      type: String,
      required: true
    }
})

const Nonce = mongoose.model('Nonce', nonceSchema)

module.exports = Nonce

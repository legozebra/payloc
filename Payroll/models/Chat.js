const mongoose = require('mongoose')

const settingsSchema = mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  restoreId: {
    type: String
  }
});

const chatModel = mongoose.model('Chats', settingsSchema)

module.exports = chatModel

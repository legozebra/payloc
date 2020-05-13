const mongoose = require('mongoose')

const shiftSchema = mongoose.Schema({
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
        required: true
    },
    employeeIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    shiftCap: Number,
    claimable: Boolean,
    note: String,
    published: {type: Boolean, default: true},
    deleteLock: {type: Boolean, required: true, default: false},  // Whether if the shift already has a clock record on it. If yes, please don't modify it for the sake of data integrity. - aka clocked or not
    dateCreated: Date

});

module.exports = mongoose.model('Shift', shiftSchema)

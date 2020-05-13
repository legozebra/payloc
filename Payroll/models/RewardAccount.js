const mongoose = require('mongoose')

const RewardAccount= mongoose.Schema({
    orgId: {
        type: String,
        required: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    pointsBalance: {
        type: Number,
        default: 0
    },
    redeemEligible: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('RewardAccount', RewardAccount)

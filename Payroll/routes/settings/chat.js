const express = require('express'),
  router = express.Router(),
  config = require('../../config.json'),
  sessAuth = require('../../helpers/sessAuth'),
  render = require('../../helpers/render'),
  ChatModel = require('../../models/Chat');

router.post('/', sessAuth.verifyLogin, (req, res, next) => {
  ChatModel.findOneAndUpdate({userId: req.session.auth.user._id}, {
    restoreId: req.body.restoreId
  }, {upsert: true}).exec()
  res.end('')
});

module.exports = router
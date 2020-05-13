const express = require('express'),
  router = express.Router(),
  config = require('../../config.json'),
  sessAuth = require('../../helpers/sessAuth'),
  render = require('../../helpers/render');

router.get('/', sessAuth.verifyManagerLoginRedirect, (req, res, next) => {
  res.redirect(config.auth.authEndpoint + '/admin')
});

module.exports = router
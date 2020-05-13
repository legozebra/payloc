const error   = require('../helpers/error'),
      config  = require('../config.json'),
      randomstring = require('randomstring'),
      uuidv4 = require('uuid/v4'),
      crypto = require('crypto')

const sessAuth = {
  login: (req, res) => {
    const nonce = uuidv4()
    const redirectURL = req.protocol + '://' + req.get('host') + '/admin'
    const HMAC = generateHMAC(redirectURL + nonce, config.auth.appSecret)
    res.redirect(req.protocol + '://' + req.get('host') + "/login/?appID=" + config.auth.appID + "&nonce=" + nonce + "&redirect=" + redirectURL + "&signature=" + HMAC)
    return;
  },
  loginToSupport: (req, res, url = 'admin') => {
    const nonce = uuidv4()
    const redirectURL = req.protocol + '://' + req.get('host') + '/' + url;
    const HMAC = generateHMAC(redirectURL + nonce, config.support.appSecret)
    res.redirect(req.protocol + '://' + req.get('host') + "/login/?appID=" + config.support.appID + "&nonce=" + nonce + "&redirect=" + redirectURL + "&signature=" + HMAC)
    return;
  }
}

function generateHMAC(message, passInSecret) {
  const hmac = crypto.createHmac('sha256', passInSecret.toString());
  hmac.update(message.toString());
  return hmac.digest('hex')
}


module.exports = sessAuth

const express = require('express'),
      router = express.Router()

router.get('/', (req, res, next) => {
  res.redirect('https://scheduler.payloc.io')
})

module.exports = router

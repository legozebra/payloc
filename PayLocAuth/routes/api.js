const express = require('express'),
      router = express.Router(),
      config = require('../config.json'),
      User = require('../models/User'),
      crypto = require('crypto'),
      App = require('../models/App'),
      Organization = require('../models/Organization'),
      Ticket = require('../models/Ticket'),
      async = require('async'),
      randomstring = require("randomstring"),
      subscription = require('../helpers/subscription')

router.get('/ticket/:ticket/redeem', (req, res, next) => {
  if(req.params.ticket == '') {
    return res.error('Ticket required', 400)
  }
  const errorMessage = 'Ticket error'
  const ticket = req.params.ticket
  Ticket.findOne({ticket: ticket}, (err, ticketObj) => {
    if(err || ticketObj == null || ticketObj.redeemed) {
      return res.error(errorMessage, 401)
    }
    if (Number(ticketObj.expiration) < Math.floor(Date.now() / 1000)) {
      return res.error(errorMessage, 401)
    }
    const expirationTimestamp = Math.floor(Date.now() / 1000) + (3600 * 2)
    ticketObj.expiration = expirationTimestamp // NOTE: extend the ticket's expiration date so API can keep using it
    ticketObj.redeemed = true
    ticketObj.save((err) => {
      if (err) {
        return res.error('Unable to renew ticket', 500)
      }
      return res.json(ticketObj)
    })
  })
})

router.get('/ticket/:ticket/userInfo', (req, res, next) => {
  ticketing(res, req.params.ticket, (ticketObj) => {
    getFullUserInOrg(res, ticketObj, ticketObj.entitlement._id, (user) => {
      res.json(user)
    })
  })
})

router.get('/ticket/:ticket/userInfo/:user', (req, res, next) => {
  const ticket = req.params.ticket
  const user = req.params.user
  ticketing(res, ticket, (ticketObj) => {
    getFullUserInOrg(res, ticketObj, user, (user) => {
      res.json(user)
    })
  })
})

router.get('/ticket/:ticket/orgInfo', (req, res, next) => {
  const ticket = req.params.ticket
  ticketing(res, ticket, (ticketObj) => {
    const orgId = ticketObj.entitlement.authorizedOrgs
    Organization.findOne({_id: orgId}, (err, org) => {
      if (err || org === null) {
        return res.error('organization not found. possible data collision', 500)
      }
      return res.json(org)
    })
  })
})

router.get('/ticket/:ticket/orgInfo/:productId', (req, res, next) => {
  const ticket = req.params.ticket;
  ticketing(res, ticket, (ticketObj) => {
    const orgId = ticketObj.entitlement.authorizedOrgs;
    Organization.findOne({_id: orgId}, (err, orga) => {
      if (err || orga === null) {
        return res.error('organization not found. possible data collision', 500)
      }
      const org = orga.toObject();
      subscription.checkProduct(org.billingCustomerId, req.params.productId).then((result) => {
        org.subscription = false;
        if (result !== false && result !== "freeprod") {
          subscription.getSubscription(result).then((result) => {
            org.subscription = result;
            return res.json(org)
          })
        } else {
          return res.json(org)
        }
      });
    })
  })
});


router.get('/ticket/:ticket/checkProduct/:productId', (req, res, next) => {
  const ticket = req.params.ticket;
  ticketing(res, ticket, (ticketObj) => {
    const orgId = ticketObj.entitlement.authorizedOrgs;
    Organization.findOne({_id: orgId}, (err, orga) => {
      if (err || orga === null) {
        return res.error('organization not found. possible data collision', 500)
      }
      const org = orga.toObject();
      subscription.checkProduct(org.billingCustomerId, req.params.productId).then((result) => {
        res.json({success: (result !== false && result !== "freeprod")});
      });
    })
  })
});

/**
router.post('/ticket/:ticket/userInfo/batch/', (req, res, next) => {
  const ticket = req.params.ticket
  ticketing(res, ticket, (ticketObj) => {
    const response = {}
    model.find({
      '_id': { $in: [
        mongoose.Types.ObjectId('4ed3ede8844f0f351100000c'),
        mongoose.Types.ObjectId('4ed3f117a844e0471100000d'),
        mongoose.Types.ObjectId('4ed3f18132f50c491100000e')
      ]}
    }, function(err, docs){
      console.log(docs);
    });
    User.find({}).then(function(users) {
      var jobQueries = [];

      users.forEach(function(u) {
        jobQueries.push(jobSchema.find({u_sno:s.u.sno}));
      });

      return Promise.all(jobQueries );
    }).then(function(listOfJobs) {
      res.send(listOfJobs);
    }).catch(function(error) {
      res.status(500).send('one of the queries failed', error);
    });
  })
})
**/

function getFullUserInOrg(res, ticketObj, userId, cb) {   //Get user with organization info attached and sensisive info removed.
  User.findOne({authorizedOrgs: ticketObj.entitlement.authorizedOrgs, _id: userId}, (err, userObj) => {
    if (err || !userObj) {
      return res.error('User not found or you do not have sufficient permission', 400)
    }
    userObj = userObj.toObject()
    userObj.orgId = userObj.authorizedOrgs
    delete userObj.password
    delete userObj.username
    delete userObj.dateCreated
    delete userObj.__v
    Organization.findOne({_id: userObj.orgId}, (err, orgObj) => {
      if (orgObj) {
        orgObj = orgObj.toObject()
        delete orgObj.authorizedUsers
        delete orgObj.__v
        userObj.org = orgObj
      }
      return cb(userObj)
    })
  })
}

function ticketing(res, ticket, cb) {
  Ticket.findOne({ticket: ticket}, (err, ticketObj) => {
    if(err || ticket == null) {
      res.error('ticket not found', 401)
      return false
    }
    checkTicket(res, ticketObj, (result) => {
      cb(ticketObj)
    })
  })
}

function checkTicket(res, ticketObj, cb) {
  if (ticketObj == null ){
    return res.error('expired ticket', 401);
  }
  if (Number(ticketObj.expiration) < Math.floor(Date.now() / 1000)) {
    res.error('expired ticket', 401)
    return false
  }
  extendTicket(ticketObj, (result) => {
    cb(result)
  })
}

function extendTicket(ticketObj, cb) {
  const expirationTimestamp = Math.floor(Date.now() / 1000) + (3600 * 2)
  ticketObj.expiration = expirationTimestamp // NOTE: extend the ticket's expiration date so API can keep using it
  ticketObj.redeemed = true
  ticketObj.save((err) => {
    if (err) {
      res.error('Unable to renew ticket ' & req.params.ticket & '.', 500)
      return false
    }
    cb(true)
  })
}

module.exports = router

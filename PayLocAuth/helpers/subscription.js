const error   = require('../helpers/error'),
  config  = require('../config.json'),
  randomstring = require('randomstring'),
  uuidv4 = require('uuid/v4'),
  stripe = require("stripe")(config.stripe.stripeSk),
  crypto = require('crypto');

const subscription = {
  checkProduct: async (customerId, productId) => {
    /**
     * Return codes:
     * 0: _success_
     * 1: orgId does not have a validate customer ID in stripe
     * 2: no applicable subscription found
     * 3: wrong mode
     */
    if (productId === '' || productId === undefined) {
      return "freeprod"; // no entitlement required
    }
    if (customerId === undefined || customerId === null || customerId === "") {
      return false;
    }
    const customer = await stripe.customers.retrieve(customerId);

    if (!customer) {
      return false;
    }
    const subscriptions = customer.subscriptions.data;
    if (subscriptions.length === 0) {
      return false;
    }
    let found = false;
    for (let i = 0; i < subscriptions.length; i++) {
      if (subscriptions[i].status !== 'canceled' && subscriptions[i].status !== 'unpaid') {

        const items = subscriptions[i].items.data;

        for (var ii = 0; ii < items.length; ii++) {
          console.log(items[ii].plan.id)
          if (items[ii].plan === null || items[ii].plan === undefined) {
            // something is wrong
          } else if (items[ii].plan.id === productId) {
            return subscriptions[i].id;
          }
        }
      }
    }
    return false;

  },
  getProduct: async (productId) => {
     return stripe.plans.retrieve(productId)
  },
  getSubscription: async (subId) => {
    return stripe.subscriptions.retrieve(subId)
  }
};

module.exports = subscription;

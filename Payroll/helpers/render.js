const error   = require('../helpers/error'),
  config  = require('../config.json'),
  randomstring = require('randomstring'),
  uuidv4 = require('uuid/v4'),
  Chat = require('../models/Chat'),
  Settings = require('../models/Settings'),
  _ = require('lodash'),
  Intercom = require('intercom-client'),
  crypto = require('crypto');

const IntercomClient = global.IntercomClient;

const render = {
  page: (req, res, page, moduleID, title, data = {}) => {
    // return res.json(req.session)
    let renderingData = data;
    Chat.findOne({userId: req.session.auth.user._id}, (err, chat) => {
      if (chat !== null && chat.restoreId !== null) {
        renderingData.restoreId = chat.restoreId;
      } else {
        renderingData.restoreId = '';
      }
      const user = req.session.auth.user;
      const name = user.name;
      if (user.dateCreated === undefined || user.dateCreated === null) {
        user.dateCreated = undefined
      }
      const baseProduct = _.filter(req.session.auth.subscription.items.data, function(o) {
        return o.plan.id === config.baseProductId;
      });
      const premiumProduct = _.filter(req.session.auth.subscription.items.data, function(o) { return o.plan.id === config.premiumProductId; });
      const intercomhmac = crypto.createHmac('sha256', config.intercomHMACSecret);
      intercomhmac.update(String(user._id));
      if (req.session.orgSettings === null) {
        // new org without timezone imported
        console.log('org settings created ' + req.session.auth.org._id);
        const newSettings = {
          orgId: req.session.auth.org._id,
          OT_Tolorance: 0,
          Timezone: req.session.auth.org.timezone
        };
        Settings.create(newSettings);
        req.session.orgSettings = newSettings

      }
      let plan = "base";
      if (premiumProduct.length > 0) {
        plan = "premium";
      }
      _.merge(renderingData, {
        moduleID: moduleID,
        pageTitle: title,
        user: user,
        org: req.session.auth.org,
        subscription: req.session.auth.subscription,
        plan: plan,
        baseProduct: baseProduct.length > 0,
        premiumProduct: premiumProduct.length > 0,
        firstname: name.substr(0,name.indexOf(' ')),
        lastname: name.substr(name.indexOf(' ')+1),
        timezone: req.session.orgSettings.Timezone,
        intercomhmac: intercomhmac.digest('hex'),
        authEndpoint: config.auth.authEndpoint,
        url: req.originalUrl
      });

      global.IntercomClient.users.update({
        email: user.username,
        name: user.name,
        created_at: user.dateCreated,
        user_id: user._id,
        custom_attributes: {
          userId: user._id,
          timezone: renderingData.timezone,
          accesslevel: user.accessLevel,
          hourlyRate: user.hourlyRate || 0,

        },
        companies: [
          {
            company_id: renderingData.org._id,
            name: renderingData.org.name,
            created_at: renderingData.subscription.created,
            plan: renderingData.plan,
            custom_attributes: {
              subscription_status: renderingData.subscription.status,
              trial_start_at: renderingData.subscription.trial_start,
              trial_end_at: renderingData.subscription.trial_end,
              baseProduct: renderingData.baseProduct,
              premiumProduct: renderingData.premiumProduct,
              timezone: renderingData.timezone,
              GPS: renderingData.GPS,
              acctId: renderingData.subscription.customer
            }
          }
        ]
      }, (user) => {
        // console.log(user)
      });

      if (req.session.orgSettings.GPS !== undefined) {
        _.merge(renderingData, {
          GPS: req.session.orgSettings.GPS.GPSEnforcement
        })
      } else {
        _.merge(renderingData, {
          GPS: false
        })
      }
      res.render('pages/' + page, renderingData)
    })
  }
};

module.exports = render;

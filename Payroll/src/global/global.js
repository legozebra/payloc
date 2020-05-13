console.log('PayLoc Scheduler Core JS - OK');
import loadIntercom from './intercom.js'
import Raven from 'raven-js';
import logo from '../img/logo.png';
require("babel-core/register");
require("babel-polyfill");
import $ from 'jquery'

$(document).ready(() => {
  $('#logoImg').attr('src', logo);
  const $collapsible = $('.collapsible');
  $collapsible.collapsible();
  $collapsible.sideNav('show');
  FS.identify(window.intercomSettings.user_id, {
    displayName: window.userDisplayName
  });
});

// Raven Starts - Set up Error Tracking
Raven
  .config('https://ef56667950da489798dbded09a255d08@sentry.io/243813')
  .install();
// Raven Ends

// Intercom Starts
(function(){var w=window;var ic=w.Intercom;if(typeof ic==="function")
{ic('reattach_activator');ic('update',intercomSettings);}else
{var d=document;var i=function(){i.c(arguments)};i.q=[];i.c=function(args)
{i.q.push(args)};w.Intercom=i;function l()
{var s=d.createElement('script');s.type='text/javascript';s.async=true;
  s.src='https://widget.intercom.io/widget/ip0zhm67';
  var x=d.getElementsByTagName('script')[0];
  x.parentNode.insertBefore(s,x);}if(w.attachEvent){w.attachEvent('onload',l);}
else{w.addEventListener('load',l,false);}}})();
// Intercom Ends


// Full Story Start
  window['_fs_debug'] = false;
  window['_fs_host'] = 'fullstory.com';
  window['_fs_org'] = '9HF14';
  window['_fs_namespace'] = 'FS';
  (function (m, n, e, t, l, o, g, y) {
    if (e in m) {
      if (m.console && m.console.log) {
        m.console.log('FullStory namespace conflict. Please set window["_fs_namespace"].');
      }
      return;
    }
    g = m[e] = function (a, b) {
      g.q ? g.q.push([a, b]) : g._api(a, b);
    };
    g.q = [];
    o = n.createElement(t);
    o.async = 1;
    o.src = 'https://' + _fs_host + '/s/fs.js';
    y = n.getElementsByTagName(t)[0];
    y.parentNode.insertBefore(o, y);
    g.identify = function (i, v) {
      g(l, {uid: i});
      if (v) g(l, v)
    };
    g.setUserVars = function (v) {
      g(l, v)
    };
    g.identifyAccount = function (i, v) {
      o = 'account';
      v = v || {};
      v.acctId = i;
      g(o, v)
    };
    g.clearUserCookie = function (c, d, i) {
      if (!c || document.cookie.match('fs_uid=[`;`]*`[`;`]*`[`;`]*`')) {
        d = n.domain;
        while (1) {
          n.cookie = 'fs_uid=;domain=' + d +
            ';path=/;expires=' + new Date(0).toUTCString();
          i = d.indexOf('.');
          if (i < 0) break;
          d = d.slice(i + 1)
        }
      }
    };
  })(window, document, window['_fs_namespace'], 'script', 'user');
  // Full Story Ends



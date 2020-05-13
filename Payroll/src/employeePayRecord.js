const path = require('path');

import './global/';
import './payroll/payroll.css'
import './payroll/jquery.dynatable'
import  './payroll/jquery.dynatable.css'

$(document).ready(() => {
  $.ajax({
    url: '/payroll/employee/' + window.payId + '/table',
    success: function(data){
      $('#table').dynatable({
        features: {
          paginate: false,
          sort: true,
          pushState: true,
          search: false,
          recordCount: true,
          perPageSelect: false
        },
        dataset: {
          records: data.table
        }
      });
    }
  });
  $('#contactBtn').click(() => {
    Intercom('showNewMessage',
      'Payment ID: ' + window.payId + '\n' +
      'Please describe your situation below and we will get back to you ASAP. ');
  })
});

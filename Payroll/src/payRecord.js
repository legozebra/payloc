const path = require('path');

import './global/';
import './payroll/payroll.css'
import './payroll/jquery.dynatable'
import  './payroll/jquery.dynatable.css'

$(document).ready(() => {
  $.ajax({
    url: '/payroll/history/' + window.payId + '/table',
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
  $('#researchBtn').click(() => {
    Intercom('showNewMessage', 'Please send us more details about what information are you looking for, and we will research it for you in our database. \n' +
      'Payment ID: ' + window.payId + '\n' +
      'Please enter your data request below: ');
  })
});

const path = require('path');

import './global/';
import './payroll/payroll.css'
import './payroll/jquery.dynatable'
import  './payroll/jquery.dynatable.css'

$(document).ready(() => {
  $.ajax({
    url: '/payroll/employee/table',
    success: function(data){
      $('#table').dynatable({
        features: {
          paginate: false,
          sort: true,
          pushState: true,
          search: true,
          recordCount: true,
          perPageSelect: true
        },
        dataset: {
          records: data.table
        }
      });
    }
  })
});

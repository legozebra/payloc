const path = require('path');

import './global/';
import './payroll/payroll.css'

$(document).ready(() => {
  $.ajax({
    url: '/payroll/table',
    success: function(data){
      $('#action').attr('disabled', data.disabledContinue);
      $('#issues').html(data.issues);

      $('#table').dynatable({
        features: {
          paginate: false,
          sort: true,
          pushState: true,
          search: false,
          recordCount: true,
          perPageSelect: true
        },
        dataset: {
          records: data.table
        }
      });
    }
  });
  $('#action').click(() => {
    $('#action').attr('disabled', true);
    var request = [];
    var stop = false;
    $("form#payroll :input").each((i, v) => {
      if ($(v).val() === '') {
        stop = true
      }
      request.push({
        clockId: $(v).data('clock'),
        employeeId: $(v).data('id'),
        pay: $(v).val(),
        workedMinutes: $(v).data('length')
      })
    });
    if (stop) {
      swal('Sorry', 'You must enter a payment amount for each clock record. If no wage is earned, enter 0. ', 'warning');
      $('#action').removeAttr('disabled');
      return;
    }
    $.post('/payroll/pretax', {
      data: JSON.stringify(request)
    }, (data) => {
      if (data.error || !data) {
        return swal('Error', data.message, 'error')
      }
      window.location.replace('/payroll/' + data)
    });
  });

  $('#config').click(() => {
    window.location.replace('/settings/payroll/org');
  })

});

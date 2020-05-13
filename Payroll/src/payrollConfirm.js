import $ from "jquery";

const path = require('path');

import './global/';
import './payroll/payroll.css'

$(document).ready(() => {
  $('.modal').modal();
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
      records: table
    }
  });


  $('#goBack').click(() => {
    history.go(-1)
  })

  $('#action').click(() => {
    $('#action').attr('disabled', true);
    $('#goBack').attr('disabled', true);
    $('#wait').modal('open', {
      dismissible: false
    });
    $.post('/payroll/pay/' + payrollid, {data: JSON.stringify(table)}, (data) => {
      $('#wait').modal('close');
      if (data.error || !data) {
        $('#action').removeAttr('disabled');
        $('#goBack').removeAttr('disabled');
        return swal('Error', data.message, 'error');
      }
      $('#info').html('<p>Paychecks are issued. Please print this page for your record. </p>');
      $('#actions').hide();
      $('#pageTitle').html('<p>Run Payroll - Confirmation</p>');
      swal('Paychecks Issued!', data.message , 'success')
    })
  })

})

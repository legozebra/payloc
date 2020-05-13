// import Raven from "raven-js/typescript/raven";

const path = require('path');

import './global/';
import $ from "jquery";

$(document).ready(() => {
  $('#save').click(async () => {
    $('#save').attr('disabled', true);
    $.post('/settings/advanced', {
      testMode: $('#testmode').is(":checked"),
      oneAddressMode: $('#oneAddressMode').is(":checked")
    }, (data) => {
      if (data.error || !data) {
        $('#save').removeAttr('disabled');
        return swal('Error', data.message, 'error')
      }
      $('#save').removeAttr('disabled');
      Materialize.toast('Settings are successfully applied.', 2000)
    })

  })
});
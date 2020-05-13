import $ from "jquery";
import Raven from 'raven-js';
const path = require('path');
import './global/';

$(document).ready(() => {
  const stripe = Stripe(window.stripePk);
  $('#save').click(async () => {
    $('#save').attr('disabled', true);
    const primary_line = $('#primary_line').val();
    const zip = $('#zip').val();
    if (primary_line === '' || zip === '') {
      $('#save').removeAttr('disabled');
      return swal('Error', 'Please fill in all required information', 'error');
    }
    const $accountNumber = $('#account_number');
    let achModified = true;
    // console.log($accountNumber.val().substring(0,7));
    if ($accountNumber.val().substring(0,7) === '*******' ) {
      // ach info not modified
      achModified = false;
      $('#save').removeAttr('disabled');
      return swal('Confirmation Required', 'Please re-enter your account number to confirm this change. ', 'error');
    }
      const {token, error} = await stripe.createToken('bank_account', {
        country: 'US',
        currency: 'usd',
        routing_number: $('#routing_number').val(),
        account_number: $accountNumber.val(),
        account_holder_name: $('#account_payer').val(),
        account_holder_type: 'company',
      });
      if (error) {
        Raven.captureMessage(JSON.stringify(error), {
          level: 'error'
        });
        console.log(error);
        $('#save').removeAttr('disabled');
        return swal('Error Setting Up ACH Deposit', 'Unable to validate your ACH deposit information. Please double check the routing number and account number, then try again. ', 'error');
      }

    const tokenId = token.id;
    $.post('/settings/payroll/org', {
      tokenId: tokenId,
      first: primary_line,
      second: $('#secondary_line').val(),
      fourCode: zip,
      achModified: achModified,
      routing_number: $('#routing_number').val(),
      account_number: $accountNumber.val()
    }, (data) => {
      if (data.error || !data) {
        $('#save').removeAttr('disabled');
        return swal('Error', data.message, 'error')
      }
      $('#save').removeAttr('disabled');
      swal({
          title: "Success",
          text: "Settings are successfully applied.",
          type: "success"
        },
        () => {
          location.reload();
        });
    })

  })
});
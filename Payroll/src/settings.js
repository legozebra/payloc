const path = require('path');

import './global/';

$('#stripeInfo').hide()
$('#checkView').hide()

$(document).ready(() => {
  payoutMethod = window.payoutMethod;
  stripeSetup = window.stripeSetup;
  $('#stripeInfo').hide()
  switch (payoutMethod) {
    case "stripe":
    if (payoutMethod !== 'stripe') {
      $('#stripeView').show();
      $('#checkView').hide();
      $('#stripeInfo').hide();
    } else {
      $('#stripeView').hide();
      $('#checkView').hide();
      $('#stripeInfo').show();
    }
    $('input[type=radio][name=paymentmethod][value=stripe]').attr('checked', true)
    break;

    case "check":
    $('#checkView').show()
    $('#stripeView').hide()
    $('#stripeInfo').hide()
    $('input[type=radio][name=paymentmethod][value=check]').attr('checked', true)
    break;

    default:
    $('#checkView').hide()
    $('#stripeView').hide()
    $('#stripeInfo').hide()

  }
  Materialize.updateTextFields();
  $('#saveAddr').click(() => {
    $('#saveAddr').attr('disabled', true)

    $.post('/settings/payroll/address', {
      first: $('#primary_line').val(),
      second: $('#secondary_line').val(),
      fourCode: $('#zip').val(),
    }, (data, err) => {
      $('#saveAddr').attr('disabled', false)
      if (data.error || !data) {
        return swal('Error', data.message, 'error')
      }
      swal({
        title: "Success",
        text: "Your address has been updated",
        type: "success"
      },
      function(){
        window.location.replace("/")
      });
    })
  })
  $('input[type=radio][name=paymentmethod]').change(function() {

    const $checkView = $('#checkView');
    const $stripeView = $('#stripeView');
    const $stripeInfo = $('#stripeInfo');
    switch (this.value) {
      case "stripe":
      if (payoutMethod !== 'stripe') {
        $stripeView.show();
        $checkView.hide();
        $stripeInfo.hide()
      } else {
        $stripeView.hide();
        $checkView.hide();
        $stripeInfo.show()
      }
      $('input[type=radio][name=paymentmethod][value=stripe]').attr('checked', true)
      break;

      case "check":
      $checkView.show();
      $stripeView.hide();
      $stripeInfo.hide();
      $('input[type=radio][name=paymentmethod][value=check]').attr('checked', true)
      break;

      default:
      $checkView.hide();
      $stripeView.hide();
      $stripeInfo.hide()

    }
  });
  $('#connectStripe').click(() => {
    $('#connectStripe').attr('disabled', true)
    window.open(stripeSetup)

  })
  $('#loginStripe').click(() => {
    $('#connectStripe').attr('disabled', true)
    window.open('./loginStripe')
    location.reload()
  })

});

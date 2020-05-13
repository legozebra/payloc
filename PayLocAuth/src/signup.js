import './global/'
import jstz from './jstz.min'
function pay(handler) {
  let username = $('#email').val();
  let password = $('#passwordUp').val();
  let name = $('#name').val();
  let bizName = $('#businessName').val();
  let phone = $('#phone').val();
  if (username === '' || password === '' || name === '' || bizName === '' || phone === '') {
    enableSignupBtn()
    return swal('Error', 'All fields are required. We promise to keep your information safe', 'error')
  }
  const couponCode = $('#couponCode').val().trim()
  if (couponCode !== '') {
    // Have a coupon code - check with backend
    $.get('/signup/coupon/' + couponCode, (data) => {
      if (!data || data.error){
        $("#actionBtn").removeAttr("disabled");
        $("#actionBtn").text('Sign Up');
        return swal('Error', data.message, 'error')
      }
      $('#couponCode').attr("type", data.type); // Coupon code type
      $('#couponCode').attr("bypassStripe", data.bypassStripe); // Coupon code type
      if (data.bypassStripe) {
        // Credit card not required
        signup(null);
      } else {
        // Credit card still required
        handler.open({
          name: 'PayLoc',
          description: 'Sign up with Coupon Code',
          amount: 0,
          zipCode: true,
          billingAddress: false,
          panelLabel: 'Sign Up',
          email: $('#email').val()
        });
        fbq('track', 'AddPaymentInfo');
      }
    })
  } else {
  // action button clicked - trigger stripe checkout
    handler.open({
      name: 'PayLoc',
      description: 'Free Trial',
      amount: 0,
      zipCode: true,
      billingAddress: false,
      panelLabel: 'Activate Free Trial',
      email: $('#email').val()
    });
  }
}
let handler;
$(document).ready(() => {
  $('#couponCode').attr("type", -1);
    handler = StripeCheckout.configure({
    key: window.stripeKey,
    image: 'https://s3-us-west-1.amazonaws.com/payloc/assets/square_padded.png',
    locale: 'auto',
    token: signup
    });
  $('#actionBtn').click(() => {
    pay(handler);
  });
});

function enableSignupBtn() {
  $("#actionBtn").removeAttr("disabled")
  $("#actionBtn").text('Sign Up')
}

function signup (token, type = $('#couponCode').attr('type')) {
  let $actionBtn = $('#actionBtn');
  $actionBtn.prop('disabled', true);
  $actionBtn.text('Activating');

  var tz = jstz.determine().name();
  let username = $('#email').val();
  let password = $('#passwordUp').val();
  let name = $('#name').val();
  let bizName = $('#businessName').val();
  let phone = $('#phone').val();

  $actionBtn.attr("disabled", "disabled")
  $actionBtn.text('Signing Up')
  $.post('/signup', { username: username, password: password , name: name, bizName: bizName, tz: tz, phone: phone}, function(data) {
    if (!data || data.error ) {
      enableSignupBtn()
      return swal('Error', data.message, 'error')
    }
    const loginPage = (data) => {
      if (data.error || !data) {
        return swal({
          title: 'Error',
          text: data.message,
          type: 'error'}, () => {
          location.reload()
        });
      }
      fbq('track', 'Lead');
      fbq('track', 'CompleteRegistration');
      fbq('track', 'Purchase');
      $actionBtn.css('background-color', '#3CAF32');
      $actionBtn.text('Welcome to PayLoc');
      setTimeout(() => {
        window.location = 'https://scheduler.payloc.io'
      }, 1500);
    };
    const coupon = $('#couponCode').val().trim()
    if (coupon === '') {
      $.post('/admin/subscribe/' + window.SKU, {
        token: token.id,
        quantity: window.quantity,
        freetrial: true,
        type: type
      }, loginPage);
    } else {
      let tokenID = ''
      if (token !== null) {
        tokenID = token.id
      }
      $.post('/admin/coupon/' + window.SKU + '/' + coupon , {
        token: tokenID,
        type: type,
        quantity: window.quantity,
      }, loginPage);
    }

  })


}

window.checkKey = (e) => {
  if (e.keyCode === 13) {
    pay(handler);
  }
}

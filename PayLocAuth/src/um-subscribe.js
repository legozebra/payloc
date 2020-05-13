import './global/'
$(document).ready(() => {
  var handler = StripeCheckout.configure({
    key: window.stripeKey,
    image: 'https://s3-us-west-1.amazonaws.com/payloc/assets/square_padded.png',
    locale: 'auto',
    token: function(token) {
      let $actionBtn = $('#actionBtn');
      $actionBtn.prop('disabled', true);
      $actionBtn.text('Activating');
      $.post('/admin/subscribe/' + window.SKU, {
        token: token.id,
        quantity: window.quantity,
        freetrial: true
      }, (data) => {
        if (data.error || !data) {
          return swal({
            title: 'Error',
            text: data.message,
            type: 'error'}, () => {
            location.reload()
          });
        }
        $actionBtn.css('background-color', '#3CAF32');
        $actionBtn.text('Welcome to PayLoc');
        setTimeout(() => {
          window.location = '/admin'
        }, 500);
      })
    }
  });
  $('#actionBtn').click(() => {
    // action button clicked - trigger stripe checkout
    handler.open({
      name: 'PayLoc',
      description: 'Free Trial - ' + window.productName,
      amount: 0,
      zipCode: true,
      billingAddress: true,
      panelLabel: 'Activate Free Trial',
      email: window.email
    });
  });

});

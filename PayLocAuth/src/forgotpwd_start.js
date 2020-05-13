import './global/'
function resetPwdStart(){
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
      window.location = 'https://scheduler.payloc.io'
    }, 1500);
  });
}
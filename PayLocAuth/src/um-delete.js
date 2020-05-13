import './global/'
$(document).ready(() => {
  $('#deleteUser').click(() => {
    if ($('#username').val().toLowerCase() !== window.username.toLowerCase()) {
      return swal('Error', 'Please enter the username to confirm', 'error')
    }
    $.post('delete', {}, (data) => {
      if (data.error || !data) {
        return swal('Error', data.message, 'error')
      }
      return swal({
        title: 'Success',
        text: 'User has been deleted',
        type: 'success'}, () => {
        window.location = '/admin'
      })
    })

  })
  $('#goBack').click(() => {
    window.location = '/admin'
  })
})

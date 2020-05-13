import './global/'
$(document).ready(() => {
  $('#actionBtn').click(() => {
    let info = {}
    info.name = $('#name').val()
    info.username = $('#username').val()
    info.accessLevel = $('#accessLevel').val()
    info.hourlyRate = $('#hourlyRate').val()
    info.phone = $('#phone').val()

    $.post('', info, (data) => {
      if (data.error || !data) {
        return swal('Error', data.message, 'error')
      }
      return swal({
        title: 'Success',
        text: data.message,
        type: 'success'}, () => {
        window.location = data.redirect
      })
    })
  })
  $('#goBack').click(() => {
    window.location = '/admin'
  })
})

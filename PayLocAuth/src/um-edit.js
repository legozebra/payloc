import './global/'
$(document).ready(() => {
  $('#actionBtn').click(() => {
    let info = {}
    info.name = $('#name').val()
    info.username = $('#username').val()
    info.accessLevel = $('#accessLevel').val()
    info.flatRate = $('#flatRate').val()
    info.percentage = $('#percentage').val()
    info.hourlyRate = $('#hourlyRate').val()
    info.phone = $('#phone').val()

    $.post('', info, (data) => {
      if (data.error || !data) {
        return swal('Error', data.message, 'error')
      }
      return swal('Success', info.name + ' has been updated', 'success')
    })
  })
  $('#resetPasswd').click(() => {
    $.post('resetPasswd', {}, (data) => {
      if (data.error || !data) {
        return swal('Error', data.message, 'error')
      }
      return swal('Success', data.message, 'success')
    })
  })
  $('#deleteUser').click(() => {
    window.location = 'delete'
  })
  $('#goBack').click(() => {
    window.location = '/admin'
  })
})

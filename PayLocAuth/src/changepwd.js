import './global/'
$(document).ready(() => {
  $('#actionBtn').click(() => {
    var info = {}
    info.newpassword = $('#password1').val()
    if (info.newpassword == "") {
      return swal('Error', 'Please enter a new password', 'error')

    }
    if ($('#password2').val() !== info.newpassword) {
      return swal('Error', 'Password and confirm password do not match. Please try again', 'error')
    }
    info.accessLevel = $('#accessLevel').val()

    $.post('/login/changepassword', info, (data) => {
      if (data.error || !data) {
        swal({
          title: "Error",
          text: data.message,
          type: "error"
        },
        function(){
          window.location.replace("/login")
        });
      }
      swal({
        title: "Success",
        text: "Your password has been changed",
        type: "success"
      },
      function(){
        window.location.replace('https://scheduler.payloc.io')
      });
    })
  })
  $('#resetPasswd').click(() => {
    $.post('resetPasswd', {}, (data) => {
      if (data.error || !data) {
        return swal('Error', data.message, 'error')
      }
      swal('Password Reset Success', data.message, 'success')
    })
  })
})

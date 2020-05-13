const path = require('path');
import './global/';

$(document).ready(() => {
  $('#loginBtn').click(() => {
    login();
  });
  $("#login-form").submit(function (e) {
    e.preventDefault();
    login()
  });
});


function login(){
  let username = $('#username').val();
  let password = $('#password').val();
  if (username === '' || password === '') {
    let $loginBtn = $("#loginBtn");
    $loginBtn.css('background-color', '#DD4444');
    $loginBtn.effect("shake");
    setTimeout(() => {
      $("#loginBtn").css('background-color', '#3A86A8');
    }, 1000);
    return swal('Error', 'Please enter both your username and your password.', 'error')
  }
  $.post('/login', { username: username, password: password }, function(data) {
    if (data.error || !data) {
      return swal('Error', data.message, 'error')
    }
    let $loginBtn = $("#loginBtn");
    $loginBtn.css('background-color', '#3CAF32');
    $loginBtn.text('Welcome ' + data.name);
    setTimeout(() => {
      window.location = data.redirect
    }, 500)
  })
}
function submitForm(e){
  e.preventDefault();
  login();
  return false;
}

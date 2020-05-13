import './global/'
import './global/um'
$(document).ready(() => {
  $.ajax({
    url: '/admin/ajax/users',
    success: function(data){
      $('#table').dynatable({
        dataset: {
          records: data
        }
      });
    }
  });
  $('#logout').click(() => {
    window.location = '/logout'
  })
  $('#create').click(() => {
    window.location = '/admin/create'
  })
})

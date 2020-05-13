const path = require('path');

import './global/';
import './calendar/';
import moment from 'moment-timezone';

$(document).ready(() => {
  $('.modal').modal();
  $('#tradeOffSubmit').hide();
  $('select').material_select();
  $('#calendar').fullCalendar({
    header: {
      left: 'prev,next today',
      center: '',
      right: 'agendaWeek,agendaDay'
    },
    defaultView: 'agendaWeek',
    navLinks: true, // can click day/week names to navigate views
    editable: false,
    timezone: window.timezone,
    eventLimit: true, // allow "more" link when too many events
    eventSources: [
      {
        url: '/scheduler/schedule' // use the `url` property
      }
    ],
    eventClick: function(calEvent, jsEvent, view) {
      if (calEvent.ownShift && !calEvent.pastShift) {
        $('#tradeOffAction').show()
      } else {
        $('#tradeOffAction').hide()
      }
      $('#shiftInfoTitle').text(calEvent.start.format('MMMM DD: HH:mm A') + ' - ' + calEvent.end.format('HH:mm A'))
      $('#employees').html(calEvent.title.replace(/(?:\r\n|\r|\n)/g, '<br />'))
      $('#tradeOffAction').unbind().click(() => {
        return tradeShiftCalPresent(calEvent.id, calEvent)
      });
      window.Intercom("trackEvent", "Viewed shift details", {
        pastShift: calEvent.pastShift,
        ownShift: calEvent.ownShift,
        shiftId: calEvent.id
      });
      $('#shiftInfo').modal('open');
    }
  });
});
function tradeShiftCalPresent(shiftId, oldEvent) {
  $('#shiftInfo').modal('close');
  $('#requesteeSelect').modal('close');
  if ($('#tradeShiftCal').html() !== '') {
    $('#tradeShiftCal').fullCalendar('destroy');
    $('#tradeShiftCal').html('')
    //$('#tradeShiftCal').fullCalendar('render');
  }
  $('#tradeShift').modal('open', {
    dismissible: false
  });
  $('#tradeShiftCal').fullCalendar({
    header: {
      left: 'prev,next today',
      center: '',
      right: 'basicWeek,basicDay'
    },
    defaultView: 'basicWeek',
    navLinks: true,
    editable: false,
    timezone: "utc",
    eventLimit: true,
    eventSources: [
      {
        url: '/scheduler/schedule/tradeOff/' + shiftId // use the `url` property
      }
    ],
    eventClick: function(calEvent, jsEvent, view) {
      $('#tradeShift').modal('close');
      $('#requesteeSelector').empty()
      $.each(calEvent.people, function(i, obj){
        $('#requesteeSelector').append($('<option>').text(obj.name).attr('value', obj.id));
        $('select').material_select();
      });
      $('select').material_select();
      $('#requesteeSelectAction').unbind().click(() => {
        return tradeShiftInfoPresent(calEvent, shiftId, oldEvent)
      })
      $('#backCalView').unbind().click(() => {

        return tradeShiftCalPresent(shiftId, oldEvent)
      })
      $('#requesteeSelect').modal('open');
    }
  });
  window.Intercom("trackEvent", "Viewed shift exchange calendar", {
    shiftId: shiftId
  });
}

function tradeShiftInfoPresent(calEvent, shiftId, oldEvent) {
  $('#requesteeSelect').modal('close');
  $('#date').val(calEvent.start.format('MMMM Do YYYY dddd'));
  $('#startTime').val(calEvent.start.format('LT'));
  $('#endTime').val(calEvent.end.format('LT'));
  $('#duration').val(moment.duration(moment.utc(calEvent.end.diff(calEvent.start)).format("HH:mm:ss")).humanize());

  $('#requestee_date').val(oldEvent.start.format('MMMM Do YYYY dddd'));
  $('#requestee_startTime').val(oldEvent.start.format('LT'));
  $('#requestee_endTime').val(oldEvent.end.format('LT'));
  $('#requestee_duration').val(moment.duration(moment.utc(oldEvent.end.diff(oldEvent.start)).format("HH:mm:ss")).humanize());

  $('#requesteeName').text($('#requesteeSelector').find(":selected").text() + '\'s Shift');

  $('#tradeOffSubmitBtn').unbind().click(() => {
    const newShiftId = $('#requesteeSelector').val();
    $.post('/scheduler/tradeOff/' + oldEvent.id + '/to/' + calEvent.id + '/with/' + newShiftId, { }, function(data) {
      if (data.error || !data) {
        return swal('Error', data.message, 'error')
      }
      window.Intercom("trackEvent", "Initiated a shift exchange", {
        shiftId: shiftId,
        targetShiftId: newShiftId
      });
      swal('Request Submitted', data.message,'success')
    })
    $('#tradeInfo').modal('close');
  })
  Materialize.updateTextFields();
  $('#tradeInfo').modal('open', {
    dismissible: false
  });
}

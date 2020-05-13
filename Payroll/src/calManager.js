const path = require('path');

import $ from 'jquery'
import 'materialize-css';
import './global/';
import './calendar/';
import './calendar/calManager.css'
import moment from 'moment-timezone';


$(document).ready(() => {
  var selectize;
  $('.modal').modal();
  $('#tradeOffSubmit').hide();
  $('#recurrence').material_select();
  $('#dp').hide();
  $('#shiftCap').hide();

  $('#daily').val(0.5);
  Materialize.updateTextFields();

  var customizedDate = false;
  var dpObj;

  $.get('/scheduler/manager/employees', (data) => {
    if (data.error) {
      swal('Error', data.message, 'error')
    }
    selectize = $('#employeeSelecter').selectize({
      maxItems: null,
      valueField: 'id',
      labelField: 'name',
      searchField: 'name',
      options: data,
      create: false
    })[0].selectize

  })

  $('#calendar').fullCalendar({
    header: {
      left: 'prev,next today',
      center: '',
      right: 'month,agendaWeek'
    },
    defaultView: 'agendaWeek',
    navLinks: true,
    editable: true,
    eventLimit: true,
    timezone: window.timezone,
    eventSources: [
      {
        url: '/scheduler/schedule'
      }
    ],
    selectable: true,
    selectHelper: true,
    viewRender: async (view, element) => {
      let start = view.start.toISOString(false);  // A Moment that is the first visible day.
      let end = view.end.toISOString(false);  // A Moment that is the exclusive last visible day.
      let predictedWages = await $.get('/scheduler/manager/predict', {
        start: start,
        end: end
      });
      $('#estimation').html(view.start.format("MMM DD") + ' - ' + view.end.format("MMM DD") + '<br>' +
        'Scheduled ' + predictedWages.shiftCount + ' shifts<br>' +
        'Estimated cost $' + predictedWages.amount);
      $('#estimationCard').show();
      // Materialize.toast('$' + predictedWages.amount, 500)
    },
    select: (start, end) => {
      /**
       var title = prompt('Event Title:');
       var eventData;
       if (title) {
        eventData = {
          title: title,
          start: start,
          end: end
        };
        $('#calendar').fullCalendar('renderEvent', eventData, true); // stick? = true
      }
       $('#calendar').fullCalendar('unselect');
       **/
      selectize.clear();
      $('#createNewShiftModal').modal('open');
      $('#timeStart').val(moment.utc(start).format("dddd, MMMM Do, YYYY [at] H:mm A"))
      $('#timeEnd').val(moment.utc(end).format("dddd, MMMM Do, YYYY [at] H:mm A"))

      Materialize.updateTextFields();

      const endAt = moment(start).add(1, 'years').toDate()
      dpObj = $('.datepicker').pickadate({
        selectMonths: true,
        selectYears: 7,
        onSet: (context) => {
          customizedDate = true
        }
      });

      if (!customizedDate) { //if the user has not selected an preferred end date, a date will be populated for them.
        dpObj.pickadate('picker').set('select', endAt);
        customizedDate = false
      }

      $("#recurrence").change(() => {
        if($('#recurrence').val() > 0) {
          $('#dp').show()
        } else {
          $('#dp').hide()
        }
      });

      $("#employeeSelecter").change(() => {
        $("#shiftCap").val(selectize.items.length)
      });

      $('#createAction').unbind().click(() => {
        return createAction(start, end)
      })
    },
    eventClick: (calEvent, jsEvent, view) => {
      $('#shiftInfoTitle').text(calEvent.start.format('MMMM DD: HH:mm A') + ' - ' + calEvent.end.format('HH:mm A'))
      $('#employees').html(calEvent.title.replace(/(?:\r\n|\r|\n)/g, '<br />'))
      $('#delete').unbind().click(() => {
        return deleteShift(calEvent.id)
      });
      $('#shiftInfo').modal('open');
    },
    eventDrop: changeShift,
    eventResize: changeShift
  });

  function changeShift(event, delta, revertFunc) {
    $.post('/scheduler/manager/shift/' + event.id, {
      start: event.start.format(),
      end: event.end.format()
    }, (data) => {
      if (data.error || !data) {
        revertFunc();
        return Materialize.toast(data.message, 3000)
      }
      if (data.revert) {
        revertFunc();
        return Materialize.toast(data.message, 1000)
      }
      $('#calendar').fullCalendar('refetchEvents');
      window.Intercom("trackEvent", "Modified a shift", {
        shiftID: event.id,
        start: event.start.format(),
        end: event.start.format(),
      });
      return Materialize.toast('Shift Modified', 1000)
    })
  }

  function createAction(start, end) {
    if (selectize.items.length === 0 ){
      return swal('Error', 'Please select some workers to create a shift', 'error')
    }
    $('#createNewShiftModal').modal('close');
    $('#wait').modal('open', {
      dismissible: false
    });

    $.post('/scheduler/manager/shift', {
      start: start.format(),
      end: end.format(),
      employeeIds: JSON.stringify(selectize.items),
      shiftCap: parseInt($('#shiftCap').val()),
      note: $('#note').val(),
      until: moment(dpObj.pickadate('picker').get('select').obj).toISOString(),
      recurrence: $('#recurrence').val()
    }, (data) => {
      $('#wait').modal('close');
      if (data.error || !data) {
        $('#createNewShiftModal').modal('open');
        return swal('Error', data.message, 'error')
      }
      $('#calendar').fullCalendar('refetchEvents');
      window.Intercom("trackEvent", "Created a new shift");
      return Materialize.toast('Your shifts have been created!', 2000)
    })
  }


  function deleteShift(calEventId) {
    swal({
      title: "Delete Shift",
      text: "Are you sure you want to delete this shift?",
      type: "warning",
      showCancelButton: true,
      confirmButtonColor: "#DD6B55",
      confirmButtonText: "Yes, delete it!",
      closeOnConfirm: true
    }, () => {
      $('#shiftInfo').modal('close');
      $.post('/scheduler/manager/shift/delete', {shift: calEventId}, (data) => {
        if (data.error || !data) {
          return swal('Error', data.message, 'error')
        }
        $('#calendar').fullCalendar('refetchEvents');
        Materialize.toast('The shift has been deleted', 1000)
      })
    });
  }

});

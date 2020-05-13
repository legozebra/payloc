const path = require('path');

import './global/';
import $script from 'scriptjs'
window.initGoogleMaps = function () {
  console.log('Google maps loading');
  $script('https://maps.google.com/maps/api/js?key=' + window.googleMapsKey + '&libraries=places', function () {
    console.log('Google maps loaded. Loading location picker... ');
    require('./dependencies/locationpicker.jquery.min.js');


    var GPSInfo;
    $('document').ready(()=> {
      $('#radiusSelector').hide();
      $('#theMap').hide();
      $('#companyAddressWrapper').hide();

      $('#save').click(() => {
        $(this).attr('disabled', true);
        $.post('/settings/attendance', {
          GPS: JSON.stringify({
            latitude: parseFloat($('#us2-lat').val()),
            longitude: parseFloat($('#us2-lon').val()),
            radius: $('#us2-radius').val(),
            locationName: $('#us2-address').val()
          }),
          enforced: $('#enforce').is(":checked")
        }, (err, data) => {
          if (data.error || !data) {
            return swal('Error', data.message, 'error')
          }
          swal('Settings Updated', 'Your settings have been successfully updated. ', 'success')
        })
      });
      if (window.GPSSetup) {
        //$('#locationPickerDiv').hide();
        $('#radiusSelector').show();
        $('#theMap').show();
        $('#companyAddressWrapper').show();
        GPSInfo = JSON.parse(window.GPSInfo);
        $('#companyLocation').locationpicker({
          location: {
            latitude: GPSInfo.GPSLocation[1],
            longitude: GPSInfo.GPSLocation[0]
          },
          zoom: 17,
          radius: GPSInfo.GPSRadius,
          inputBinding: {
            latitudeInput: $('#us2-lat'),
            longitudeInput: $('#us2-lon'),
            radiusInput: $('#us2-radius'),
            locationNameInput: $('#us2-address')
          },
          markerInCenter: false,
          enableAutocomplete: true,
          onchanged: function (currentLocation, radius, isMarkerDropped) {
            $('#radiusSelector').show();
            $('#theMap').show();
            $(this).locationpicker('autosize');
          }
          //mapTypeId: google.maps.MapTypeId.HYBRID
        });

      } else {
        $('#companyLocation').locationpicker({
          location: {
            latitude: 42.3559048,
            longitude: -71.1005181
          },
          zoom: 17,
          radius: 30,
          inputBinding: {
            latitudeInput: $('#us2-lat'),
            longitudeInput: $('#us2-lon'),
            radiusInput: $('#us2-radius'),
            locationNameInput: $('#us2-address')
          },
          markerInCenter: false,
          enableAutocomplete: true,
          onchanged: function (currentLocation, radius, isMarkerDropped) {
            $('#radiusSelector').show();
            $('#theMap').show();
            $(this).locationpicker('autosize');
          }
          //mapTypeId: google.maps.MapTypeId.HYBRID
        });
        setTimeout(()=>{
          $('#us2-address').val('');
        },1000);
      }
      setTimeout(()=>{
        $('#companyAddressWrapper').show();
      },1000);
    });
    function initMap() {
      setTimeout(() => {
        var uluru = {lat: window.GPSInfo.GPSLocation[1], lng: window.GPSInfo.GPSLocation[0]};
        var map = new google.maps.Map(document.getElementById('map'), {
          zoom: 4,
          center: uluru
        });
        var marker = new google.maps.Marker({
          position: uluru,
          map: map
        });
        map.resize()
      }, 1000);
    }

  })
}

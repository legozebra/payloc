import jQuery from 'jquery'
import './global'
import '../../node_modules/bootstrap/dist/css/bootstrap.css'
import '../../node_modules/bootstrap/dist/css/bootstrap-theme.css'
import '../../node_modules/bootstrap/dist/js/bootstrap'
import './sweetalert.css'
import './sweetalert.min.js'
import './PayLocLogin.css'
import 'jquery-ui'
import 'jquery-placeholder'


// IE8 Start
import 'es5-shim';
if(!(typeof Promise !== "undefined" && Promise.toString().indexOf("[native code]") !== -1)){
  console.log('Please do not use Internet Explorer');
  window.location = 'https://help.payloc.io/get-started/why-isnt-payloc-working-in-my-browser'
}
$(document).ready(() => {
  $('input, textarea').placeholder();
});
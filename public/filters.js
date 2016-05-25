app.filter('statusClass', function () {
  return function (ext, calls) {

    for(var i = 0; i < calls.length; i++) {
      if(!calls[i].ringing && calls[i].ext == ext.ext) {
        return 'btn-success';
      }
    }

    switch(ext.status) {
      case 'unavailable': return 'btn-default disabled';
      case 'ringing': return 'btn-warning';
      case 'available':
      default:
        return 'btn-primary';
    }
  };
});

app.filter('statusIcon', function () {
  return function (ext, calls) {

    for(var i = 0; i < calls.length; i++) {
      if(!calls[i].ringing && calls[i].ext == ext.ext) {
        return 'fa-phone';
      }
    }

    switch(ext.status) {
      case 'unavailable': return 'fa-minus-circle';
      case 'ringing': return 'fa-phone pulse';
      case 'available':
      default:
        return 'fa-user';
    }
  };
});

app.filter('callClass', function() {
  return function (call) {
    var cssClass;

    if(call.active) cssClass = 'call-active';
    else cssClass = 'call-on-hold';
    
    //if(call.ringing) cssClass = cssClass + ' ringing';

    return cssClass;
  };
});

app.filter('secondsInHhmmss', function() {
  return function (seconds) {
    var date = new Date(1970,0,1);
    date.setSeconds(seconds);
    
    return date.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
  };
});
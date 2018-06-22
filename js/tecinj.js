/*
  This is injected into the page to have access to existing javascript variables, events,
  and functions. It will send messages back and forth to the content_script that
  injected it; which will pipe back to the background script for the extension.

*/

// orchil.js - doReceive(msg)
var orig = doReceive;
doReceive = function(msg) {
  doReceiveOverride(msg);
  var ret = orig.apply(this, arguments);
  return ret;
};

function doReceiveOverride(msg) {
  console.log(msg);
  document.dispatchEvent(new CustomEvent('tecReceiveMessage', {
    detail: {
      timestamp: new Date().toISOString(),
      data: msg
    }
  }));
}

document.addEventListener('tecSendMessage', function(e) {
  var msg = e.detail.data;
  if (msg) {
    // orchil.js - doSend(message, noecho)
    console.log('Sending command: ' + msg);
    doSend(msg, true);
  }
});




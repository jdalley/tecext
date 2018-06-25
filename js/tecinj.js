/**
 * This is injected into the page to have access to existing javascript variables, events, data
 * from web sockets, and functions. It will send messages back and forth to the content script
 * that injected it; which will pipe back to the background script for the extension.
 */

// Override the doReceive function on the page to intercept data, then send it on.
var orig = doReceive;
doReceive = function (msg) {
    doReceiveOverride(msg);
    // Ref: orchil.js - doReceive(msg)
    var ret = orig.apply(this, arguments);
    return ret;
};

/**
 * Send intercepted data to the content script:
 */
function doReceiveOverride(msg) {
    console.log(msg);
    document.dispatchEvent(new CustomEvent('tecReceiveMessage', {
        detail: {
            timestamp: new Date().toISOString(),
            data: msg
        }
    }));
}

// Receive commands from the content script, and send them to the existing doSend
// function on the page. This function pipes the command back to the web socket.
document.addEventListener('tecSendMessage', function (e) {
    var msg = e.detail.data;
    if (msg) {
        console.log('Sending command: ' + msg);
        // Ref: orchil.js - doSend(message, noecho)
        doSend(msg, true);
    }
});




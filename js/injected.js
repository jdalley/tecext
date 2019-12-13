/**
 * This is injected into the page to have access to existing javascript variables, events, data
 * from web sockets, and functions. It will send messages back and forth to the content script
 * that injected it; which will pipe back to the background script for the extension.
 */

// Override the doReceive function on the page to intercept data, then send it on.
const origDoReceive = doReceive;
doReceive = function (msg) {
    doReceiveOverride(msg);

    // Colorize 'say to'
    // if (msg.indexOf('say to') >= 0
    //     || msg.indexOf(' says') >= 0
    //     || msg.indexOf(' ask') >= 0
    //     || msg.indexOf(' exclaim') >= 0
    //     || msg.indexOf(' wink') >= 0) {
    //     msg = '</font><font color="#0020ff">' + msg;
    // }

    origDoReceive.apply(this, arguments);
    return;
};

// Send intercepted data to the content script:
function doReceiveOverride(msg) {
    console.log(msg);
    document.dispatchEvent(new CustomEvent('tecReceiveMessage', {
        detail: {
            timestamp: new Date().toISOString(),
            data: msg
        }
    }));
}

// Override the doSend function on the page to intercept commands entered.
const origDoSend = doSend;
doSend = function (msg, noecho) {
    doSendOverride(msg);
    // Don't apply the original function if a slash command is detected.
    if (msg.indexOf('/') !== 0) {
        origDoSend.apply(this, arguments);
    }
    return;
}

// Send intercepted commands to the content script:
function doSendOverride(msg) {
    console.log(`doSendOverride: ${msg}`);
    document.dispatchEvent(new CustomEvent('tecSendCommand', {
        detail: {
            timestamp: new Date().toISOString(),
            command: msg
        }
    }));
}

// Receive commands from the content script, and send them to the existing doSend
// function on the page. This function pipes the command back to the web socket.
document.addEventListener('tecSendMessage', function (e) {
    const msg = e.detail.data;
    if (msg) {
        console.log(`Sending command: ${msg}`);
        // Ref: orchil.js - doSend(message, noecho)
        doSend(msg, true);
    }
});




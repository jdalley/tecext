/*
  Script loaded as a content_script. Primary intent is to inject a script that can work
  with existing javascript loaded on the page; passing data back and forth through here
  as a proxy.

*/

/*
  Inject the script used to work directly with the contents of the page, hooking into
  relevant events, variables, and data.
*/
var s = document.createElement('script');
s.src = chrome.extension.getURL('js/tecinj.js');
(document.head||document.documentElement).appendChild(s);
s.onload = function() {
    s.remove();
};

// Listen for received messages from tecinj.js
document.addEventListener('tecReceiveMessage', function(e) {
  // Send received message to the background script.
  chrome.runtime.sendMessage({
    type: "tec-receive-message",
    message: e.detail
  });
});

// Listen for messages to send from the background script.
chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type == "tec-message-send") {
    // Send message to the content script:
    document.dispatchEvent(new CustomEvent('tecSendMessage', {
      detail: {
        timestamp: request.message.timestamp,
        data: request.message.data
      }
    }));
  }
});



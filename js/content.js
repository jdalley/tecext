/**
 * This content_script is used to pass data back and forth between the script it injects
 * into the existing page, and the background script for the extension.
 */

// Inject the script used to work directly with the contents of the page; hooking into
// relevant events, variables, and data from web sockets.
const script = document.createElement("script");
script.src = chrome.extension.getURL("js/injected.js");
(document.head || document.documentElement).appendChild(script);
script.onload = function () {
  script.remove();
};

// Listen for received messages from the injected script:
document.addEventListener("tecReceiveMessage", function (e) {
  // Send received message to the background script.
  chrome.runtime.sendMessage({
    type: "tec-receive-message",
    message: e.detail,
  });
});

// Listen for received commands from the injected script:
document.addEventListener("tecSendCommand", function (e) {
  // Send received command to the background script.
  chrome.runtime.sendMessage({
    type: "tec-send-command",
    message: e.detail,
  });
});

// Listen for in-page UI related commands from the injected script:
document.addEventListener("tecUICommand", function (e) {
  switch (e.detail.command) {
    case "openEditScripts":
      // Open the edit-scripts popup
      chrome.runtime.sendMessage({
        type: "tec-edit-scripts",
        message: e.detail,
      });
      break;
    default:
  }
});

// Listen for messages from the background script to send to the injected script:
chrome.extension.onMessage.addListener(function (
  request,
  sender,
  sendResponse
) {
  if (request.type == "tec-message-send") {
    // Send message to the injected script:
    document.dispatchEvent(
      new CustomEvent("tecSendMessage", {
        detail: {
          timestamp: request.message.timestamp,
          data: request.message.data,
        },
      })
    );
  }
});

// Write messages from the background script to the game window
chrome.extension.onMessage.addListener(function (
  request,
  sender,
  sendResponse
) {
  if (request.type == "tec-client-message") {
    // Add message to output
    const output = document.getElementById("output");
    const div = document.createElement("div");
    const text = document.createTextNode(`\r\n${request.message.data}`);

    div.appendChild(text);
    div.style.color = "red";
    div.style.fontSize = "smaller";
    output.appendChild(div);

    // scroll to bottom
    output.scrollTop = output.scrollHeight;
  }
});

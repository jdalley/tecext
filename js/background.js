// Background console logger
var bkg = chrome.extension.getBackgroundPage();
bkg.console.log("background.js initialized...");

// Listen for received messages from teccontent.js (ultimately from tecinj.js)
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type == "tec-receive-message") {
    // request.message.timestamp
    // request.message.data

    bkg.console.log(request.message.data);
  }
});

// Intended to be used from a single context menu
function startScript(info, tab) {
  bkg.console.log('Starting script...');

  sendMessage("@rps");

  // info.selectionText;
  // info.linkUrl;

  // chrome.tabs.create({
  //   url: msUrl
  // });
}

// Send a message to the content script, which will forward it to the injected script.
function sendMessage(msg) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id,
      {
        type: "tec-message-send",
        message: {
          timestamp: new Date().toISOString(),
          data: msg
        }
      });
  });
}

// Add the context menu for selections and links.
chrome.contextMenus.create({
  title: "Start script...",
  contexts: ["all"],
  onclick: startScript
});

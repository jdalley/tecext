/*
    Background script used to house logic for features global to the extension.
    Communication to and from the content/injected scripts gets handled here.
*/

var targetTitle = 'The Eternal City - Orchil (Beta) - Skotos';
var runRepeat = false;
var repeatCommand;
var bkg = chrome.extension.getBackgroundPage();
bkg.console.log("background.js initialized...");

// Add the context menu for selections and links.
chrome.contextMenus.create({
    id: "start-script",
    title: "[TEC] Start script...",
    contexts: ["all"],
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId == "start-script") {
        bkg.console.log('Starting script...');

        // info.selectionText;
        // info.linkUrl;

        // chrome.tabs.create({
        //   url: msUrl
        // });
    }
});

/*
    Listen for received messages from teccontent.js (ultimately from tecinj.js)
    request.message.timestamp
    request.message.data
*/
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.type == "tec-receive-message") {
        bkg.console.log(request.message.data);
        parseMessage(request.message.data);
    }
});


// Entry point for figuring out what to do with messages received from the server.
function parseMessage(data) {
    // TODO: Hook in a decision tree here based on settings/current state as this expands.
    if (runRepeat) {
        if (data.indexOf("You are no longer busy.") >= 0) {
            setTimeout(function () {
                sendCommand(repeatCommand);
            }, 300)
        }
    }
}


// Send a command to the content script, which will forward it to the injected script.
function sendCommand(msg) {
    bkg.console.log("Sending message: " + msg);

    chrome.tabs.query({ title: targetTitle }, function (tabs) {
        if (tabs.length === 0) {
            bkg.console.log("Tab not found, title changed?");
        }

        chrome.tabs.sendMessage(tabs[0].id,
            {
                type: "tec-message-send",
                message: {
                    timestamp: new Date().toISOString(),
                    data: msg
                }
            }
        );
    });
}

// Simple repeat support:
function startRepeat(command) {
    sendCommand(command);

    runRepeat = true;
    repeatCommand = command;
}

function stopRepeat() {
    runRepeat = false;
    repeatCommand = '';
    bkg.console.log("Repeat stopped.");
}

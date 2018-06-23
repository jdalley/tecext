/*
    Background script used to house logic for features global to the extension.
    Communication to and from the content/injected scripts gets handled here.
*/

var bkg = chrome.extension.getBackgroundPage();
bkg.console.log("background.js initialized...");

var targetTabTitle = 'The Eternal City - Orchil (Beta) - Skotos';

// Simple repeat flag and command
var runRepeat = false;
var repeatCommand;

// Script stuff, first pass:
var target;
var commandList = [];
var currentCmdIndex = 0;
var commandOverride;
var endIt = false;
var endItParse;
var weapon;

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
        if (data.indexOf('You are no longer busy.') >= 0) {
            setTimeout(function () {
                sendCommand(repeatCommand);
            }, Math.floor(Math.random() * 300) + 200)
            return;
        }
    }

    if (target && commandList.length > 0 && weapon) {
       combatScript(data);
    }
}

// Naive function to manage and act on the current script:
// TODO: Figure out how to make this more composable and dynamic.
function combatScript(data) {
    if (data.indexOf(commandList[currentCmdIndex].parse) >= 0) {
        currentCmdIndex++;
    }

    if (endIt) {
        // Override based on specific scenarios
        // TODO: Move this into something more dynamic.
        if (data.indexOf('falls unconscious') >= 0
                    || data.indexOf('You hit') >= 0
                    || data.indexOf('You miss') >= 0) {
            commandOverride = 'kill ' + target;
        }

        if (data.indexOf(endItParse) >= 0) {
            commandOverride = '';
        }
    }

    // Handle fumble
    if (data.indexOf('You fumble!') >= 0) {
        commandOverride = 'take ' + weapon;
    }
    if (data.indexOf('You take a') >= 0) {
        setTimeout(function() {
            sendCommand('wield ' + weapon);

            setTimeout(function() {
                sendCommand(commandList[currentCmdIndex].command + ' ' + target);
                commandOverride = '';
            }, Math.floor(Math.random() * 300) + 200);
        }, Math.floor(Math.random() * 300) + 200);
    }

    // Handle distance/approaching
    if (data.indexOf('is not close enough') >= 0) {
        setTimeout(function() {
            sendCommand('app ' + target);

            setTimeout(function() {
                sendCommand(commandList[currentCmdIndex].command + ' ' + target);
                commandOverride = '';
            }, 2000);
        }, 1000);
    }

    // Main work
    if (data.indexOf('You are no longer busy.') >= 0 || data.indexOf('walks in') >= 0) {
        var next = commandOverride ?
            commandOverride : commandList[currentCmdIndex].command + ' ' + target;

        setTimeout(function() {
            sendCommand(next);

            if (currentCmdIndex === (commandList.length - 1)) {
                currentCmdIndex = 0;
            }
        }, Math.floor(Math.random() * 300) + 200);
    }
}

// Send a command to the content script, which will forward it to the injected script.
function sendCommand(msg) {
    bkg.console.log("Sending message: " + msg);

    chrome.tabs.query({ title: targetTabTitle }, function (tabs) {
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
    bkg.console.log("Repeat started.");
    runRepeat = true;
    repeatCommand = command;
    sendCommand(command);
}

function stopRepeat() {
    runRepeat = false;
    repeatCommand = '';
    bkg.console.log("Repeat stopped.");
}

/*****************************************************************************************/
/* Temporary manual scripts */

function killCommandScript() {
    target = '';
    commandList = [];
    endIt = false;
    endItParse = '';
    weapon = '';
    commandOverride = '';
    currentCmdIndex = 0;
    bkg.console.log("Scripts killed.");
}

function twoHandBasic(tgt) {
    target = tgt;
    commandList = [];
    endIt = true;
    endItParse = 'With massive force';
    weapon = 'axe';
    commandOverride = '';
    currentCmdIndex = 0;

    commandList.push({ command: 'chop', parse: 'You raise your'});
    commandList.push({ command: 'slash', parse: 'You make a wide horizontal'});
    commandList.push({ command: 'bstrike', parse: 'With your weapon turned'});
    commandList.push({ command: 'swat', parse: 'Shifting your grip'});
    commandList.push({ command: 'strike', parse: 'You slide your lower hand'});

    var first = commandList[0].command + ' ' + tgt;
    sendCommand(first);
}

/* Temporary manual scripts */
/*****************************************************************************************/


/*
    Utility
*/
var delay = ( function() {
    var timer = 0;
    return function(callback, ms) {
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
    };
})();
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
var addAtt;

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
        // Move the command list index forward...
        currentCmdIndex++;
    }

    // Handle addAtt commandOverride off-switch
    if (commandOverride.indexOf('att') >= 0 &&
        (data.indexOf('You hit') >= 0 || data.indexOf('You miss') >= 0)) {
        commandOverride = '';
    }

    if (endIt) {
        // Override based on specific scenarios
        // TODO: Move this into something more dynamic.
        if (data.indexOf('falls unconscious') >= 0
                    || data.indexOf('You hit') >= 0
                    || data.indexOf('You miss') >= 0) {
            commandOverride = 'kill ' + target;
        }

        // Detect weapon-specific kill echo and wipe the override for next no longer busy.
        if (data.indexOf(endItParse) >= 0 && commandOverride.indexOf('kill') >= 0) {
            commandOverride = '';
        }
    }

    // Handle sweeped/knocked down after failed attack attempt:
    if (data.indexOf('You must be standing') >= 0) {
        setTimeout(function() {
            sendCommand('stand');
        }, Math.floor(Math.random() * 300) + 200)
    }

    // Handle fumble:
    if (data.indexOf('You fumble!') >= 0) {
        // Just set override since fumble requires waiting for no longer busy anyway.
        commandOverride = 'take ' + weapon;
    }
    if (data.indexOf('You take a') >= 0) {
        sendDelayedCommands([
            'wield ' + weapon,
            commandList[currentCmdIndex].command + ' ' + target
        ]);
    }

    // Handle distance/approaching
    if (data.indexOf('is not close enough') >= 0) {
        sendDelayedCommands([
            'app ' + target,
            commandOverride ? commandOverride : commandList[currentCmdIndex].command + ' ' + target
        ]);
    }

    // Main work for combat loop after 'NLB'
    if (data.indexOf('You are no longer busy.') >= 0) {
        setTimeout(function() {
            var nextCommand =
                commandOverride ? commandOverride : commandList[currentCmdIndex].command + ' ' + target;

            sendCommand(nextCommand);

            if (currentCmdIndex === (commandList.length - 1)) {
                if (addAtt) {
                    commandOverride = 'att ' + target;
                }
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

// Send a list of commands with an offset belay between them.
function sendDelayedCommands(commands) {
    if (commands && commands.length > 0) {
        var offsetMs = 1000;
        commands.forEach(function(command, index) {
            setTimeout(function() {
                sendCommand(command);
            }, offsetMs * (index + 2))
        });
        // This may cause bugs... but for now.
        commandOverride = '';
    }
}

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


/*****************************************************************************************/
/* Temporary manual scripts */


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

function killCurrentScript() {
    target = '';
    commandList = [];
    endIt = false;
    endItParse = '';
    weapon = '';
    commandOverride = '';
    currentCmdIndex = 0;
    bkg.console.log("Script killed.");
}

function twoHandBasic(theTarget, shouldEndIt) {
    target = theTarget;
    commandList = [];
    endIt = shouldEndIt;
    endItParse = 'With massive force';
    weapon = 'axe';
    addAtt = true; // Adds a regular attack into the end of the command list.
    commandOverride = '';
    currentCmdIndex = 0;

    commandList.push({ command: 'chop', parse: 'You raise your'});
    commandList.push({ command: 'slash', parse: 'You make a wide horizontal'});
    // commandList.push({ command: 'bstrike', parse: 'With your weapon turned'});
    commandList.push({ command: 'swat', parse: 'Shifting your grip'});
    commandList.push({ command: 'strike', parse: 'You slide your lower hand'});

    var first = commandList[0].command + ' ' + theTarget;
    sendCommand(first);
}

/* Temporary manual scripts */
/*****************************************************************************************/


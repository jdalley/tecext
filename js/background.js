/*
    This is the background script used to house features global to the extension.
    Communication to and from the content/injected scripts gets handled here.
*/

/*********************************************************************************************/
/* Globals, yuck */

var bkg = chrome.extension.getBackgroundPage();
bkg.console.log("background.js initialized...");

// Chrome
var targetTabTitle = 'The Eternal City - Orchil (Beta) - Skotos';

// Simple repeat
var runRepeat = false;
var repeatCommand;

// General
var target;
var commandList = [];
var currentCmdIndex = 0;
var commandOverride;

// Combat
var shouldKill = false;
var shouldKillParse;
var weaponItemName;
var addAttack;
var stance;

// Scripts:
var currentScriptType = '';
var currentScripts;

/*********************************************************************************************/
/* Extension setup and Chrome things */

/**
 * Setup popout window
 */
function openPopupWindow(tab) {
    chrome.windows.create({
            url: chrome.runtime.getURL("popup.html"),
            type: "popup",
            height: 475,
            width: 395
        }, function(win) {
            // Do something with the new window?
        }
    );
}

// Open popup window on click of the main extension icon:
chrome.browserAction.onClicked.addListener(function(tab) {
    openPopupWindow(tab);
});

// Add the context menu for opening the UI:
chrome.contextMenus.create({
    id: "open-tec-ui",
    title: "[TEC] Open UI...",
    contexts: ["all"],
});
chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId == "open-tec-ui") {
        openPopupWindow();
    }
});

// Load scripts from default or sync storage:
function loadScripts() {
    chrome.storage.sync.get("userScripts", function (data) {
        if (data && data["userScripts"]) {
            currentScripts = data["userScripts"];
        }
        else {
            fetch('/scripts/combat.json')
            .then(res => res.json())
            .then((out) => {
                if (out) {
                    currentScripts = out;
                    chrome.storage.sync.set({"userScripts": out}, function() {
                        return false;
                    });
                }
            })
        }
    });

    return false;
}

// Save scripts to the var and to sync storage:
function saveScripts(scripts) {
    if (scripts) {
        currentScripts = scripts;
        chrome.storage.sync.set({"userScripts": scripts}, function() {
            return false;
        });
    }
}

// Do the load thing...
loadScripts();


/*********************************************************************************************/
/** Communication with content scripts to send/receive messages to/from the game **/

// Listen for received messages from teccontent.js (ultimately from tecinj.js)
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    // request.message.timestamp
    // request.message.data
    if (request.type == "tec-receive-message") {
        bkg.console.log(request.message.data);
        parseMessage(request.message.data);
    }
});

/**
 * Entry point for figuring out what to do with messages received from the server.
 */
function parseMessage(data) {
    // TODO: Hook in a decision tree here based on settings/current state as this expands.
    if (runRepeat) {
        if (data.indexOf('You are no longer busy.') >= 0) {
            setTimeout(function () {
                sendCommand(repeatCommand);
            }, Math.floor(Math.random() * 300) + 400)
            return;
        }
    }

    if (target && commandList.length > 0 && currentScriptType === 'combat') {
        combatScript(data);
    }
    else if (commandList.length > 0 && currentScriptType === 'nonCom') {
        nonComScript(data);
    }
}

/**
 * Send a command to the content script, which will forward it to the injected script.
 */
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

/*********************************************************************************************/
/** Scripting: setting up and executing defined scripts **/

/**
 * Naive function to manage and act on the current combat script:
 * TODO: Figure out how to make this more composable and dynamic to work with JSON 'scripts'
 */
function combatScript(data) {
    if (commandList.length > 1 && data.indexOf(commandList[currentCmdIndex].parse) >= 0) {
        // Move the command list index forward...
        currentCmdIndex++;
    }

    // Handle addAttack commandOverride off-switch
    if (commandOverride.indexOf('att') >= 0 &&
        (data.indexOf('You hit') >= 0 || data.indexOf('You miss') >= 0)) {
        commandOverride = '';
    }

    if (shouldKill) {
        // Override based on specific scenarios
        // TODO: Move this into something more dynamic.
        if (data.indexOf('falls unconscious') >= 0
                    || data.indexOf('You hit') >= 0
                    || data.indexOf('You miss') >= 0) {
            commandOverride = 'kill ' + target;
        }

        // Detect weapon-specific kill echo and wipe the override for next no longer busy.
        if (data.indexOf(shouldKillParse) >= 0 && commandOverride.indexOf('kill') >= 0) {
            commandOverride = '';
        }
    }

    // Handle sweeped/knocked down after failed attack attempt:
    if (data.indexOf('You must be standing') >= 0) {
        setTimeout(function() {
            sendCommand('stand');
        }, getCommandDelayInMs())
    }

    // Handle fumble:
    if (data.indexOf('You fumble!') >= 0) {
        // Just set override since fumble requires waiting for no longer busy anyway.
        commandOverride = 'take ' + weaponItemName;
    }
    if (data.indexOf('You take a') >= 0) {
        sendDelayedCommands([
            'wield ' + weaponItemName,
            commandList[currentCmdIndex].command + ' ' + target
        ]);
    }

    // Handle distance/approaching
    if (data.indexOf('is not close enough') >= 0) {
        sendDelayedCommands([
            'app ' + target,
            commandOverride ?
                commandOverride : commandList[currentCmdIndex].command + ' ' + target
        ]);
    }

    // Handle stance when not auto:
    if (data.indexOf('You are not in the correct stance') >= 0) {
        if (stance) {
            sendDelayedCommands([stance]);
        }
    }

    // Main work for combat loop:
    if (data.indexOf('You are no longer busy.') >= 0) {
        setTimeout(function() {
            sendCommand(commandOverride ?
                commandOverride : commandList[currentCmdIndex].command + ' ' + target);

            if (currentCmdIndex >= (commandList.length - 1)) {
                if (addAttack) {
                    commandOverride = 'att ' + target;
                }
                currentCmdIndex = 0;
            }
        }, getCommandDelayInMs());
    }
}

/**
 * Naive function to manage and act on the current script:
 * TODO: Figure out how to make this more composable and dynamic.
 */
function nonComScript(data) {
    if (data.indexOf(commandList[currentCmdIndex].parse) >= 0) {
        // Move the command list index forward...
        currentCmdIndex++;
    }

    // Main work for combat loop after 'NLB'
    if (data.indexOf('You are no longer busy.') >= 0) {
        setTimeout(function() {
            var nextCommand =
                commandOverride ?
                    commandOverride : commandList[currentCmdIndex].command + ' ' + target;

            sendCommand(nextCommand);

            if (currentCmdIndex === (commandList.length - 1)) {
                currentCmdIndex = 0;
            }
        }, getCommandDelayInMs());
    }
}

/*********************************************************************************************/
/** Utility **/

var delay = ( function() {
    var timer = 0;
    return function(callback, ms) {
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
    };
})();

/**
 * Send a list of commands with an offset belay between them.
 */
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

function getCommandDelayInMs() {
    // Between 400 and 700 miliseconds
    return Math.floor(Math.random() * 300) + 400;
}

/*********************************************************************************************/
/** Scripting and stuff **/

/**
 * Entry point for running a script:
 */
function runScriptByName(scriptName, options) {
    bkg.console.log("Running script: " + scriptName);
    bkg.console.log("With options: " + JSON.stringify(options));

    // Get the script object by name:
    var script = currentScripts.find(obj => { return obj.scriptName === scriptName; });

    if (!script) {
        bkg.console.log("No script found matching name: " + scriptName);
    }
    else {
        commandOverride = '';
        currentCmdIndex = 0;

        target = options.target;
        weaponItemName = options.weaponItemName;
        shouldKill = options.shouldKill;
        shouldKillParse = script.shouldKillParse;
        addAttack = script.addAttack;
        stance = script.stanceCommand;
        currentScriptType = script.scriptType;

        script.commandList.forEach(function(command, index) {
            commandList.push(command);
        })

        // Kick it off...
        sendCommand(commandList[0].command + ' ' + target);

        bkg.console.log("Script " + scriptName + " loaded and started.");
    }
}

function killCurrentScript() {
    target = '';
    weaponItemName = '';
    shouldKill = false;
    shouldKillParse = '';
    runRepeat = false;
    repeatCommand = '';
    commandList = [];
    addAttack = false;
    stance = '';
    commandOverride = '';
    currentCmdIndex = 0;
    bkg.console.log("Script killed.");
}


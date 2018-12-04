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
var currentMoveNextWhen = null;
var commandOverride;

// Combat
var shouldKill = false;
var shouldKillParse;
var continueOnWalkIn = false;
var weaponItemName;
var addAttack;
var stance;

// Scripts
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
            height: 425,
            width: 395
        }, function(win) {
            // Do something with the new window?
        }
    );
}

/**
 * Load scripts from exampleScripts or sync storage:
 */
function loadScripts() {
    chrome.storage.sync.get("userScripts", function (data) {
        if (data && data["userScripts"]) {
            currentScripts = data["userScripts"];
        }
        else {
            fetch('/scripts/exampleScripts.json')
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

/**
 *  Save scripts to the var and to sync storage:
 */
function saveScripts(scripts) {
    if (scripts) {
        currentScripts = scripts;
        chrome.storage.sync.set({"userScripts": scripts}, function() {
            return false;
        });

        // Send message to popup that currentScripts have been updated:
        chrome.runtime.sendMessage({
            msg: "reload-scripts-select",
            data: {
                // TODO: Should we maybe just send the scripts here to prevent another round trip?;
            }
        });
    }
}

// Open popout window when the main extension icon is clicked:
chrome.browserAction.onClicked.addListener(function(tab) {
    openPopupWindow(tab);
});

// Add the context menu for opening the popout window:
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

// Initial script load:
loadScripts();


/*********************************************************************************************/
/** Communication with content scripts to send/receive messages to/from the game **/

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

/**
 * Entry point for figuring out what to do with messages received from the server.
 */
function parseMessage(data) {
    if (runRepeat) {
        if (data.indexOf('You are no longer busy.') >= 0) {
            setTimeout(function () {
                sendCommand(repeatCommand);
            }, getCommandDelayInMs())
            return;
        }
    }

    if (commandList.length > 0 && currentScriptType === 'combat') {
        combatScript(data);
    }
    else if (commandList.length > 0 && currentScriptType === 'nonCom') {
        nonComScript(data);
    }
}

// Listen for received messages from teccontent.js (ultimately from tecinj.js)
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    // request.message.timestamp
    // request.message.data
    if (request.type == "tec-receive-message") {
        bkg.console.log(request.message.data);
        parseMessage(request.message.data);
    }
});

/*********************************************************************************************/
/** Scripting: setting up and executing defined scripts **/

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
        currentMoveNextWhen = 'You are no longer busy';

        target = options.target;
        weaponItemName = options.weaponItemName;
        shouldKill = options.shouldKill;
        shouldKillParse = script.shouldKillParse;
        continueOnWalkIn = options.continueOnWalkIn;
        addAttack = script.addAttack;
        stance = script.stanceCommand;
        currentScriptType = script.scriptType;

        script.commandList.forEach(function(command, index) {
            commandList.push(command);
        })

        // Kick it off...
        sendCommand(getFormattedCommand());
    }
}

function runSimpleRepeat(options) {
    bkg.console.log("Starting simple repeat: " + options.command)

    killCurrentScript();

    runRepeat = true;
    repeatCommand = options.command;

    setTimeout(function() {
        sendCommand(repeatCommand);
    }, getCommandDelayInMs());
}

/**
 * Kill it with fire.
 */
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
    currentMoveNextWhen = null;
    currentScriptType = '';
    bkg.console.log("Script killed.");
}

/**
 * Used to parse and act on incoming game message data for combat scripts.
 */
function combatScript(data) {
    var matchFound = matchExpectedParse(data);
    if (matchFound) {
        if (currentCmdIndex === (commandList.length - 1)) {
            if (addAttack) {
                commandOverride = 'att ' + target;
            }
            // Reset
            currentCmdIndex = 0;
        }
        else {
            // Move the command list index forward...
            currentCmdIndex++;
        }

        // If the currentMoveNextWhen is null here, send the next command now:
        if (!currentMoveNextWhen) {
            sendNextCommand();
        }
    }

    // TODO: The custom checks below should probably be moved into a configurable area.

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
    if (data.indexOf('You fumble! You drop a') >= 0) {
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

    // Naive attempt to continue after having no target when something 'arrives'
    if (data.indexOf(' arrives.') >= 0) {
        sendNextCommand();
    }

    if (continueOnWalkIn && data.indexOf('walks in') >= 0) {
        sendNextCommand();
    }

    // Main work for combat loop:
    if (currentMoveNextWhen.length > 0 && data.indexOf(currentMoveNextWhen) >= 0) {
        sendNextCommand();
    }
}

/**
 * Used to parse and act on incoming game message data for nonCombat scripts.
 */
function nonComScript(data) {
    var matchFound = matchExpectedParse(data);
    if (matchFound) {
        if (currentCmdIndex === (commandList.length - 1)) {
            // Reset
            currentCmdIndex = 0;
        }
        else {
            // Move the command list index forward...
            currentCmdIndex++;
        }

        // If the currentMoveNextWhen is not set, send the next command now:
        if (!currentMoveNextWhen) {
            // Delay to avoid commands being sent too close together.
            sendNextCommand(700);
        }
    }

    // Send the next command after the configured currentMoveNextWhen is detected:
    if (currentMoveNextWhen.length > 0 && data.indexOf(currentMoveNextWhen) >= 0) {
        sendNextCommand();
    }
}

/**
 * Send the next command on the commandList.
 */
function sendNextCommand(additionalDelay) {
    setTimeout(function() {
        // Set override or use current command value:
        var nextCommand;

        if (commandOverride) {
            nextCommand = commandOverride
        }
        else {
            nextCommand = getFormattedCommand();
        }

        sendCommand(nextCommand);

        // Reset to a default here now to prevent it from sending back to back commands.
        currentMoveNextWhen = 'You are no longer busy';
    }, getCommandDelayInMs(additionalDelay));
}


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

/**
 * Replace expected special sequences in a command string with the appropriate
 * values from script variables. This will likely become more robust over time.
 */
function getFormattedCommand() {
    var command = commandList[currentCmdIndex].command;

    // Check if the command has moved <target> to be replaced:
    if (command.indexOf("<target>") >= 0) {
        // Check for target replacement:
        command = command.replace("<target>", target, "g");
    }
    else {
        // Tack target onto the end by default:
        command += ' ' + target;
    }

   return command;
}

/**
 * Check data from the server to determine if it satisfies the parse requirements
 * for the current command in commandList. If matched it will set the value of
 * currentMoveNextWhen (identifies the trigger to run the next command).
 */
function matchExpectedParse(data) {
    if (commandList.length < 1) {
        bkg.console.log("CommandList is empty... stop running?");
        return false;
    }

    var matchFound = false;
    var parse = commandList[currentCmdIndex].parse;
    // If the expected parse check is an array, check each:
    if (Array.isArray(parse)) {
        for (var i = 0; i < parse.length; i++) {
            if (data.indexOf(parse[i].outcome) >= 0) {
                matchFound = true;

                // Set value to detect for moving onto the next command:
                currentMoveNextWhen = parse[i].moveNextWhen;
            }
        }
    }
    else {
        if (data.indexOf(parse.outcome) >= 0) {
            // The parse is just a string, check it:
            matchFound = data.indexOf(parse.outcome) >= 0;

            // Set value to detect for moving onto the next command:
            currentMoveNextWhen = parse.moveNextWhen;
        }
   }

   return matchFound;
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

function getCommandDelayInMs(additionalDelay) {
    // Between 700 and 1000 miliseconds
    var commandDelay = Math.floor(Math.random() * 300) + 700;

    if (additionalDelay) {
        commandDelay += additionalDelay;
    }

    return commandDelay;
}

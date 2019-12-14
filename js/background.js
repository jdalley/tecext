/*
    This is the background script used to house features global to the extension.
    Communication to and from the content/injected scripts gets handled here.
*/

/*********************************************************************************************/

const bkg = chrome.extension.getBackgroundPage();
bkg.console.log('background.js initialized...');

// Chrome
const targetTabTitle = 'The Eternal City - Orchil (Beta) - Skotos';

// Simple repeat
let runRepeat = false;
let repeatCommand;

// General
let target;
let commandList = [];
let currentCmdIndex = 0;
let currentMoveNextWhen = null;
let commandOverride;

// Combat
let shouldKill = false;
let shouldKillParse;
let continueOnWalkIn = false;
let weaponItemName;
let addAttack;
let stance;

// Scripts
let currentScriptType = '';
let currentScripts;
function getCurrentScripts() {
	return currentScripts;
}

/*********************************************************************************************/
/* Extension setup and Chrome things */

/**
 * Setup popout window
 */
function openPopupWindow(tab) {
    chrome.windows.create({
            url: chrome.runtime.getURL('popup.html'),
            type: 'popup',
            height: 425,
            width: 395
        }, function(win) {
            // Do something with the new window?
        }
    );
}

/**
 * Load scripts from exampleScripts or local storage:
 */
function loadScripts() {
    chrome.storage.local.get('userScripts', function (data) {
        if (data && data['userScripts']) {
            currentScripts = data['userScripts'];
        }
        else {
            fetch('/scripts/exampleScripts.json')
            .then(res => res.json())
            .then((out) => {
                if (out) {
                    currentScripts = out;
                    chrome.storage.local.set({'userScripts': out}, function() {
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
        chrome.storage.local.set({'userScripts': scripts}, function() {
            return false;
        });

        // Send message to popup that currentScripts have been updated:
        chrome.runtime.sendMessage({
            msg: 'reload-scripts-select'
        });
    }
}

// Open popout window when the main extension icon is clicked:
chrome.browserAction.onClicked.addListener(function(tab) {
    openPopupWindow(tab);
});

// Add the context menu for opening the popout window:
chrome.contextMenus.create({
    id: 'open-tec-ui',
    title: '[TEC] Open UI...',
    contexts: ['all'],
});
chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId == 'open-tec-ui') {
        openPopupWindow();
    }
});

// Initial script load:
loadScripts();


/*********************************************************************************************/
/** Communication with content scripts to send/receive messages to/from the game **/


/**
 *  Send a command to the content script, which will forward it to the injected script.
 */
function sendCommand(msg) {
    bkg.console.log(`Sending message: ${msg}`);
    chrome.tabs.query({ title: targetTabTitle }, function (tabs) {
        if (tabs.length === 0) {
            bkg.console.log('Tab not found, title changed?');
        }
        chrome.tabs.sendMessage(tabs[0].id,
            {
                type: 'tec-message-send',
                message: {
                    timestamp: new Date().toISOString(),
                    data: msg
                }
            }
        );
    });
}

/**
 *  Send a message to the content script to be displayed in the client
 */
function sendClientMessage(msg) {
    bkg.console.log(`Sending message to client: ${msg}`)
    chrome.tabs.query({ title: targetTabTitle }, function (tabs) {
        if (tabs.length === 0) {
            bkg.console.log('Tab not found, title changed?');
        }
        chrome.tabs.sendMessage(tabs[0].id,
            {
                type: 'tec-client-message',
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

// Listen for received messages from content.js (ultimately from injected.js)
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    // request.message.timestamp
    // request.message.data
    if (request.type == 'tec-receive-message') {
        bkg.console.log(request.message.data);
        parseMessage(request.message.data);
    }
});

// Listen for received commands from content.js (ultimately from injected.js)
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.type == 'tec-send-command' && request.message.command !== 'undefined') {
        bkg.console.log(`command received: ${request.message.command}`);

        const cmdTrimmed = request.message.command.trim();
        if (cmdTrimmed.indexOf('/') === 0) {
            // Run the slash command
            slashCommand(cmdTrimmed);
        }
    }
});

/*********************************************************************************************/
/** Scripting: setting up and executing defined scripts **/

/**
 * Entry point for running a script:
 */
function runScriptByName(scriptName, options) {
    bkg.console.log(`Running script: ${scriptName}`);
    bkg.console.log(`With options: ${JSON.stringify(options)}`);

    // Get the script object by name:
    const script = currentScripts.find(obj => { return obj.scriptName === scriptName; });

    if (!script) {
        bkg.console.log(`No script found matching name: ${scriptName}`);
    }
    else {
        killCurrentScript();

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

function runSimpleRepeat(command) {
    bkg.console.log(`Starting simple repeat: ${command}`)

    killCurrentScript();
    runRepeat = true;

    setTimeout(function() {
        sendCommand(command);
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
    bkg.console.log('Script killed.');
}

/**
 * Used to parse and act on incoming game message data for combat scripts.
 */
function combatScript(data) {
    const matchFound = matchExpectedParse(data);
    if (matchFound) {
        if (currentCmdIndex === (commandList.length - 1)) {
            if (addAttack) {
                commandOverride = `att ${target}`;
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
            commandOverride = `kill ${target}`;
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
        commandOverride = `take ${weaponItemName}`;
    }
    if (data.indexOf('You take a') >= 0) {
        sendDelayedCommands([
            `wield ${weaponItemName}`,
            commandList[currentCmdIndex].command + ' ' + target
        ]);
    }

    // Handle distance/approaching
    if (data.indexOf('is not close enough') >= 0) {
        sendDelayedCommands([
            `app ${target}`,
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
    const matchFound = matchExpectedParse(data);
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
        let nextCommand;

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
        const offsetMs = 1000;
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
    let command = commandList[currentCmdIndex].command;

    // Check if the command has moved <target> to be replaced:
    if (command.indexOf('<target>') >= 0) {
        // Check for target replacement:
        command = command.replace('<target>', target, 'g');
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
        bkg.console.log('CommandList is empty... stop running?');
        return false;
    }

    let matchFound = false;
    const parse = commandList[currentCmdIndex].parse;
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

const delay = ( function() {
    var timer = 0;
    return function(callback, ms) {
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
    };
})();

function getCommandDelayInMs(additionalDelay) {
    // Between 700 and 1000 miliseconds
    let commandDelay = Math.floor(Math.random() * 300) + 700;

    if (additionalDelay) {
        commandDelay += additionalDelay;
    }

    return commandDelay;
}

function dedent(callSite, ...args) {
    function format(str) {
        let size = -1;
        return str.replace(/\n(\s+)/g, (m, m1) => {

            if (size < 0)
                size = m1.replace(/\t/g, "    ").length;

            return "\n" + m1.slice(Math.min(m1.length, size));
        });
    }

    if (typeof callSite === "string")
        return format(callSite);

    if (typeof callSite === "function")
        return (...args) => format(callSite(...args));

    let output = callSite
        .slice(0, args.length + 1)
        .map((text, i) => (i === 0 ? "" : args[i - 1]) + text)
        .join("");

    return format(output);
}

/**
 *  Handle slash commands that are received from the game client.
 */
function slashCommand(command) {
    if(command === '/help') {
        sendClientMessage(dedent(`
            Here are the available commands:
            /scripts - List of currently defined scripts
            /start [scriptName] [target] [weaponItemName] *[shouldKill] *[continueOnWalkIn] - Start a script by name, * = optional, default true
            /stop - Stop the currently running script
            /repeat [command] - Repeats a given command, expects 'No longer busy' inbetween
        `));
    }
    else if (command === '/scripts') {
        const scripts = currentScripts.map(s => s.scriptName).toString().replace(/,/g, '\r\n');
        sendClientMessage(dedent(
            `Here are the names of available scripts:
            ${scripts}`
        ));
    }
    else if (command.includes('/start')) {
        const cmdParams = command.split(/\s+/);
        // Remove empty param option if found
        if (cmdParams.includes('')) {
            cmdParams.splice(cmdParams.indexOf(''), 1);
        }

        if (cmdParams.length <= 1)
            sendClientMessage(`A script name parameter is expected when using /scripts`);

        const scriptName = cmdParams[1];
        const target = cmdParams[2];
        const weaponItemName = cmdParams[3];
        let shouldKill = true;
        let continueOnWalkIn = true;

        if (cmdParams.length >= 5)
            shouldKill = cmdParams[4];
        if (cmdParams.length >= 6)
            continueOnWalkIn = cmdParams[5];

        const script = currentScripts.find(s => {
            return s.scriptName.toLowerCase() === scriptName.toLowerCase()
        });

        if (!script)
            sendClientMessage(`Script not found.`);

        runScriptByName(scriptName, {
            target: target,
            weaponItemName: weaponItemName,
            shouldKill: shouldKill,
            continueOnWalkIn: continueOnWalkIn
        });

        sendClientMessage(`Starting script: ${scriptName} (${script.scriptFriendlyName})`);
    }
    else if (command === '/stop') {
        killCurrentScript();
        sendClientMessage(`Script stopped.`);
    }
    else if (command.includes('/repeat')) {
        const cmdParams = command.split('/repeat');
        if (cmdParams.length <= 1)
            sendClientMessage(`A command to repeat is expected when using /repeat`);

        const cmd = cmdParams[1].trim();
        runSimpleRepeat(cmd);
        sendClientMessage(`Starting to repeat the command: ${cmd}`)
    }
    else {
        sendClientMessage(`Slash command ${cmdTrimmed} not found.`)
    }
}

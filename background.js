/*
		This is the background script used to house features global to the extension.
		Communication to and from the content/injected scripts gets handled here.
*/

/*********************************************************************************************/
consoleLog("background.js initializing...");

/*********************************************************************************************/
/* Extension & Service Worker, and Chrome setup */

const targetTabTitle = "The Eternal City - Orchil (Beta) - Skotos";
const targetTabUrl = "http://client.eternalcitygame.com/tec/tec.htm";

// Collection of properties that make up the state of the extension
const storageCache = {
	// Simple repeat
	runRepeat: false,
	repeatCommand: null,
	// Repeat constantly with a delay
	runRepeatWithDelay: false,
	repeatWithDelayCommand : null,
	// General
	target : null,
	commandList : [],
	currentCmdIndex : 0,
	currentMoveNextWhen : null,
	moveNextNow : false,
	commandOverride : null,
	lastCommandRan : null,
	// Combat
	shouldKill : false,
	shouldKillParse : null,
	continueOnWalkIn : false,
	weaponItemName : null,
	addAttack : false,
	stance: null,
	// Scripts
	scriptPaused : false,
	currentScriptName : null,
	currentScriptType : null,
	currentScript : null,
};

// Store scripts separately from the cache due to potential size
let userScripts = null;

let initStorageCache = getStorageCache().then(data => {
	consoleLog(`assigning storageCache...`);
	// Copy local storage data into storageCache
	Object.assign(storageCache, data);

	// Load once per service worker init
	if (!userScripts) {
		consoleLog(`loading userScripts...`);
		loadUserScripts();
	}
});

function getStorageCache() {
	consoleLog(`getting storageCache from storage...`);
	return new Promise((resolve, reject) => {
		// Asynchronously fetch all data from storage.local. 
		// Set it with a default value if it doesn't exist.
		chrome.storage.local.get({ storageCache: storageCache }, (data) => {
			// Pass any observed errors down the promise chain.
			if (chrome.runtime.lastError) {
				return reject(chrome.runtime.lastError);
			}
			// Pass the data retrieved from storage down the promise chain.
			resolve(data);
		});
  });
}

function loadUserScripts() {
	chrome.storage.local.get(['userScripts'], function(data) {
		if (data && data["userScripts"]) {
			userScripts = data["userScripts"];
		} else {
			// No userScripts found or saved yet, load the default scripts
			fetch("/scripts/scriptCollection.json")
				.then((res) => res.json())
				.then((out) => {
					if (out) {
						userScripts = out;
						chrome.storage.local.set({ userScripts: out });
					}
				});
		}
	});
}

/**
 * Intended to be called after an event happens that changes the state
 * of the cache, requiring it be persisted to local storage.
 */
function saveStorageCache() {
	consoleLog(`saving storageCache...`);
	chrome.storage.local.set({ storageCache });
}

/**
 *  Save scripts to the var and to local storage:
 */
function saveScripts(scripts) {
	if (scripts) {
		userScripts = scripts;
		chrome.storage.local.set({ userScripts: scripts });

		// Send message to popup that userScripts have been updated:
		chrome.runtime.sendMessage({
			msg: "reload-scripts-select",
		});
	}
}

/**
 * Set up popout window
 */
 function openPopupWindow(tab) {
	chrome.windows.create(
		{
			url: chrome.runtime.getURL("popup.html"),
			type: "popup",
			height: 435,
			width: 399,
		},
		function (win) {
			// Do something with the new window?
		}
	);
}

// Open popout window when the main extension icon is clicked:
chrome.action.onClicked.addListener(async function (tab) {
	// Ensure cache has data to continue
	await initStorageCache;
	openPopupWindow(tab);
});


/*********************************************************************************************/
/** Communication with content scripts to send/receive messages to/from the game **/

/**
 *  Send a command to the content script, which will forward it to the injected script.
 */
function sendCommand(msg) {
	if (!msg) {
		consoleLog("sendCommand called with null or empty command");
		return;
	}

	consoleLog(`Command sent: ${msg}`);

	chrome.tabs.query({ url: targetTabUrl }, function (tabs) {
		if (tabs.length === 0) {
			consoleLog("Tab not found, url changed?");
		}
		chrome.tabs.sendMessage(tabs[0].id, {
			type: "tec-message-send",
			message: {
				timestamp: new Date().toISOString(),
				data: msg,
			},
		});
	});

	return;
}

/**
 *  Send a message to the content script to be displayed in the client
 */
function sendClientMessage(msg) {
	chrome.tabs.query({ url: targetTabUrl }, function (tabs) {
		if (tabs.length === 0) {
			consoleLog("Tab not found, title changed?");
		}
		chrome.tabs.sendMessage(tabs[0].id, {
			type: "tec-client-message",
			message: {
				timestamp: new Date().toISOString(),
				data: msg,
			},
		});
	});
}

/**
 * Entry point for figuring out what to do with messages received from the server.
 */
function parseMessage(data) {
	consoleLog(data, false);

	if (storageCache.scriptPaused === true) return;

	if (storageCache.runRepeat) {
		if (data.indexOf("You are no longer busy.") >= 0) {
			// TODO: Replace with alarm
			setTimeout(function () {
				sendCommand(storageCache.repeatCommand);
			}, getCommandDelayInMs());
			return;
		}
	}

	if (storageCache.commandList.length > 0 && storageCache.currentScriptType === "combat") {
		combatScript(data);
	} else if (storageCache.commandList.length > 0 && storageCache.currentScriptType === "nonCom") {
		nonComScript(data);
	}
}

/**
 * Open the edit scripts popup
 */ 
function openEditScripts() {
	chrome.windows.create(
		{
			url: "edit-scripts.html",
			type: "popup",
			height: 1000,
			width: 900,
		},
		function (window) {}
	);
}

/**
 * Listener for messages from injected.js, content.js, popup.js, and jsoneditor.js
 * and persist storageCache to local storage for applicable request types. 
 */
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	(async () => {
		// Ensure cache has data to continue
		await initStorageCache;

		switch (request.type) {
			// Message received from content.js (ultimately from injected.js)
			case "tec-receive-message":
				parseMessage(request.message.data);
				break;

			// Command received from content.js (ultimately from injected.js)
			case "tec-send-command":
				if (request.message.command !== "undefined") {
					const cmdTrimmed = request.message.command.trim();
					if (cmdTrimmed.indexOf("/") === 0) {
						// Run the slash command
						slashCommand(cmdTrimmed);
						saveStorageCache();
					}
				}
				break;
		
			// Open the edit scripts window from content.js (ultimately from injected.js)
			case "tec-edit-scripts":
				if (request.message.command !== "undefined") {
					openEditScripts();
				}
				break;

			// Command sent from popup
			case "popup-send-command":
				if (request.message) {
					sendCommand(request.message);
				}
				break;

			// Start simple repeat from popup
			case "popup-send-repeat":
				if (request.message) {
					runSimpleRepeat(request.message);
					saveStorageCache();
				}
				break;

			// Start script by name with options from popup
			case "popup-run-script": 
				if (request.message.scriptName) {
					runScriptByName(request.message.scriptName, request.message);
					saveStorageCache();
				}
				break;
			
			// Kill script from popup
			case "popup-kill-script":
				killCurrentScript();
				saveStorageCache();
				break;
			
			// Pause script from popup
			case "popup-pause-script":
				pauseCurrentScript();
				saveStorageCache();
				break;

			// Resume script from popup
			case "popup-resume-script":
				resumeCurrentScript();
				saveStorageCache();
				break;

			// Return userScripts to the popup
			case "popup-get-scripts": 
				sendResponse(userScripts);
				break;

			// Save changes to userScripts from the JSON editor
			case "editor-set-scripts":
				consoleLog(`save scripts...`);
				console.log(request.message);
				if (request.message) {
					consoleLog(`saving scripts from JSON editor...`);
					saveScripts(request.message);
				}
				break;

			default:
				consoleLog(`Listener couldn't process request type: ${request.type}`);
				break;
		}
	})();

	// Keep the messaging channel open for potential sendResponse
	return true; 
});

/*********************************************************************************************/
/** Scripting: setting up and executing defined scripts **/

/**
 * Entry point for running a script:
 */
function runScriptByName(scriptName, options) {
	// Get the script object by name:
	const script = userScripts.find((s) => {
		return s.scriptName.toLowerCase() === scriptName.toLowerCase();
	});

	if (!script) {
		consoleLog(`No script found matching name: ${scriptName}`);
	} else {
		killCurrentScript();
		sendClientMessage(
			`Starting script: ${scriptName} (${script.scriptFriendlyName})`
		);

		storageCache.currentMoveNextWhen = "You are no longer busy";

		storageCache.target = options.target || "";
		storageCache.weaponItemName = options.weaponItemName || "";
		storageCache.shouldKill =
			options.shouldKill !== null ? options.shouldKill : script.shouldKill;
			storageCache.shouldKillParse = script.shouldKillParse;
		storageCache.continueOnWalkIn =
			options.continueOnWalkIn !== null
				? options.continueOnWalkIn
				: script.continueOnWalkIn;
		storageCache.addAttack = script.addAttack;
		storageCache.stance = script.stanceCommand;
		storageCache.currentScriptType = script.scriptType;
		storageCache.currentScriptName = script.scriptName;
		storageCache.currentScript = script;
		storageCache.scriptPaused = false;

		script.commandList.forEach(function (command, index) {
			storageCache.commandList.push(command);
		});

		// Kick it off...
		sendCommand(getFormattedCommand());
	}
}

function runSimpleRepeat(command) {
	killCurrentScript();
	storageCache.runRepeat = true;
	storageCache.repeatCommand = command;

	// TODO: Replace with alarm
	setTimeout(function () {
		sendCommand(command);
	}, getCommandDelayInMs());
}

function runSimpleRepeatWithDelay(command) {
	killCurrentScript();
	storageCache.runRepeatWithDelay = true;
	storageCache.repeatWithDelayCommand = command;

	// TODO: Replace with alarm
	var intr = setInterval(function () {
		if (!storageCache.runRepeatWithDelay) clearInterval(intr);

		if (!storageCache.scriptPaused && storageCache.runRepeatWithDelay) sendCommand(command);
	}, 1000);
}

/**
 * Kill it with fire.
 */
function killCurrentScript() {
	if (storageCache.currentScriptName || storageCache.lastCommandRan) {
		sendClientMessage(`Stopping script: ${getRunningCommand()}`);
	}

	storageCache.target = "";
	storageCache.weaponItemName = "";
	storageCache.shouldKill = false;
	storageCache.shouldKillParse = "";
	storageCache.runRepeat = false;
	storageCache.repeatCommand = "";
	storageCache.runRepeatWithDelay = false;
	storageCache.repeatWithDelayCommand = "";
	storageCache.commandList = [];
	storageCache.addAttack = false;
	storageCache.stance = "";
	storageCache.commandOverride = "";
	storageCache.currentCmdIndex = 0;
	storageCache.currentMoveNextWhen = null;
	storageCache.moveNextNow = false;
	storageCache.currentScriptType = "";
	storageCache.currentScriptName = "";
	storageCache.currentscript = null;
	storageCache.scriptPaused = false;
}

/**
 * Pause the current script
 */
function pauseCurrentScript() {
	storageCache.scriptPaused = true;
	sendClientMessage(`Paused: ${getRunningCommand()}`);
}

/**
 * Resume the current script
 */
function resumeCurrentScript() {
	storageCache.scriptPaused = false;
	sendNextCommand();
	sendClientMessage(`Resumed: ${getRunningCommand()}`);
}

/**
 * Used to parse and act on incoming game message data for combat scripts.
 */
function combatScript(data) {
	const matchFound = matchExpectedParse(data);

	if (matchFound) {
		if (storageCache.currentCmdIndex === storageCache.commandList.length - 1) {
			if (storageCache.addAttack) {
				storageCache.commandOverride = `att ${storageCache.target}`;
			}
			// Reset
			storageCache.currentCmdIndex = 0;
		} else {
			// Move the command list index forward...
			storageCache.currentCmdIndex++;
		}

		// If the parse has moveNextNow set to true, or if currentMoveNextWhen
		// is null, send the next command now:
		if (storageCache.moveNextNow || !storageCache.currentMoveNextWhen) {
			// Delay to avoid commands being sent too close together.
			sendNextCommand(400);
			return;
		}
	}

	if (storageCache.shouldKill) {
		// Override based on specific scenarios
		// TODO: Move this into something more dynamic.
		const runningAttack = currentScript.addAttack;
		if (
			data.indexOf("falls unconscious") >= 0 ||
			(storageCache.commandOverride.indexOf("att") === -1 &&
				(data.indexOf("You hit") >= 0 || data.indexOf("You miss") >= 0))
		) {
			storageCache.commandOverride = `kill ${storageCache.target}`;
		}

		// Handle being stuck trying to kill something:
		if (data.indexOf("must be unconscious first") >= 0) {
			storageCache.commandOverride = "";
			sendNextCommand();
		}

		// Detect weapon-specific kill echo and wipe the override for next no longer busy.
		if (
			data.indexOf(storageCache.shouldKillParse) >= 0 &&
			storageCache.commandOverride.indexOf("kill") >= 0
		) {
			storageCache.commandOverride = "";
		}
	}

	// Attempt to continue script after a critter/target walks in/arrives.
	if (storageCache.continueOnWalkIn) {
		if (
			data.indexOf("walks in") >= 0 ||
			data.indexOf(" in from a") >= 0 ||
			data.indexOf(" arrives.") >= 0
		) {
			sendNextCommand(400);
		}
	}

	// Check extra parses to react to.
	combatGlobals(data);

	// Main work for combat loop:
	if (
		storageCache.currentMoveNextWhen &&
		storageCache.currentMoveNextWhen.length > 0 &&
		data.indexOf(storageCache.currentMoveNextWhen) >= 0
	) {
		sendNextCommand();
	}
}

/**
 * Collection of parses to handle various scenarios that come up during combat.
 * These scenarios require special commands or responses.
 * TODO: These checks should probably be moved into a configurable area.
 */
function combatGlobals(data) {
	// Handle addAttack commandOverride off-switch
	if (
		storageCache.commandOverride.indexOf("att") >= 0 &&
		(data.indexOf("You hit") >= 0 || data.indexOf("You miss") >= 0)
	) {
		storageCache.commandOverride = "";
	}

	// Handle sweeped/knocked down after failed attack attempt:
	if (data.indexOf("You must be standing") >= 0) {
		// TODO: Replace with alarm
		setTimeout(function () {
			sendCommand("stand");
		}, getCommandDelayInMs());
	}

	// Handle fumble or disarm:
	if (data.indexOf("You fumble! You drop a") >= 0) {
		// Just set override since fumble requires waiting for no longer busy anyway.
		storageCache.commandOverride = `take ${storageCache.weaponItemName}`;
	}
	if (data.indexOf("You take a") >= 0) {
		sendDelayedCommands([
			`wield ${storageCache.weaponItemName}`,
			`${storageCache.commandList[storageCache.currentCmdIndex].command} ${storageCache.target}`,
		]);
	}
	if (data.indexOf("You can't do that right now") >= 0) {
		sendDelayedCommands([
			`get ${storageCache.weaponItemName}`,
			`wield ${storageCache.weaponItemName}`,
			`${storageCache.commandList[storageCache.currentCmdIndex].command} ${storageCache.target}`,
		]);
	}
	if (data.indexOf("You must be carrying something to wield it") >= 0) {
		sendDelayedCommands([
			`get ${storageCache.weaponItemName}`,
			`wield ${storageCache.weaponItemName}`,
			`${storageCache.commandList[storageCache.currentCmdIndex].command} ${storageCache.target}`,
		]);
	}
	if (data.indexOf("You must be wielding your weapon in two hands") >= 0) {
		sendDelayedCommands([
			`wield ${storageCache.weaponItemName}`,
			`${storageCache.commandList[storageCache.currentCmdIndex].command} ${storageCache.target}`,
		]);
	}

	// Handle entagled weapon
	if (data.indexOf("You cannot attack with an entangled weapon") >= 0 
		|| data.indexOf("You cannot use that action while grappling") >= 0
		|| data.indexOf("You are unable to do that,") >= 0) {
		sendDelayedCommands([
			`free`,
			`${storageCache.commandList[storageCache.currentCmdIndex].command} ${storageCache.target}`,
		]);
	}

	// Handle distance/approaching
	if (data.indexOf("is not close enough") >= 0) {
		sendDelayedCommands([
			`engage ${storageCache.target}`,
			storageCache.commandOverride
				? storageCache.commandOverride
				: `${storageCache.commandList[storageCache.currentCmdIndex].command} ${storageCache.target}`,
		]);
	}

	// Handle stance when not auto:
	if (data.indexOf("You are not in the correct stance") >= 0) {
		if (storageCache.stance) {
			sendDelayedCommands([storageCache.stance]);
		}
	}
}

/**
 * Used to parse and act on incoming game message data for nonCombat scripts.
 */
function nonComScript(data) {
	const matchFound = matchExpectedParse(data);
	if (matchFound) {
		if (storageCache.currentCmdIndex === storageCache.commandList.length - 1) {
			// Reset
			storageCache.currentCmdIndex = 0;
		} else {
			// Move the command list index forward...
			storageCache.currentCmdIndex++;
		}

		// If the parse has moveNextNow set to true, or if  currentMoveNextWhen is null, send the next command now:
		if (storageCache.moveNextNow || !storageCache.currentMoveNextWhen) {
			// Delay to avoid commands being sent too close together.
			sendNextCommand(400);
			return;
		}
	}

	// Main work for nonCom loop:
	if (
		storageCache.currentMoveNextWhen &&
		storageCache.currentMoveNextWhen.length > 0 &&
		data.indexOf(storageCache.currentMoveNextWhen) >= 0
	) {
		sendNextCommand();
	}
}

/**
 * Send the next command on the commandList.
 */
function sendNextCommand(additionalDelay) {
	if (!shouldSendNextCommand()) {
		consoleLog(`shouldSendNextCommand was false, don't send command.`);
		return;
	}

	const commandDelayInMs = getCommandDelayInMs(additionalDelay);

	consoleLog("commandDelayInMs: " + commandDelayInMs);

	// TODO: Replace with alarm
	setTimeout(function () {
		// Set override or use current command value:
		let nextCommand;

		if (storageCache.commandOverride) {
			nextCommand = storageCache.commandOverride;
		} else {
			nextCommand = getFormattedCommand();
		}

		sendCommand(nextCommand);

		// Reset to a default here now to prevent it from sending back to back commands.
		storageCache.currentMoveNextWhen = "You are no longer busy";
		storageCache.moveNextNow = false;
	}, commandDelayInMs);
}

/**
 * Determine whether or not we should send the next command. Special rules apply.
 */
function shouldSendNextCommand() {
	var sendCommand = true;

	// Only rule, for now.
	if (storageCache.runRepeatWithDelay) {
		sendCommand = false;
	} 
	return sendCommand;
}

/**
 * Send a list of commands with an offset belay between them.
 */
function sendDelayedCommands(commands) {
	if (commands && commands.length > 0) {
		const offsetMs = 1000;
		commands.forEach(function (command, index) {
			// TODO: Replace with alarm
			setTimeout(function () {
				sendCommand(command);
			}, offsetMs * (index + 2));
		});
		// This may cause bugs... but for now.
		storageCache.commandOverride = "";
	}
}

/**
 * Replace expected special sequences in a command string with the appropriate
 * values from script variables. This will likely become more robust over time.
 */
function getFormattedCommand() {
	if (storageCache.commandList.length <= 0 || 
		storageCache.commandList[storageCache.currentCmdIndex] === undefined) {
			return "";
		}

	let command = storageCache.commandList[storageCache.currentCmdIndex].command;
	let targetRequired = true;

	// If there is a value present for targetRequired, and it is false, then don't add a target.
	if (
		storageCache.commandList[storageCache.currentCmdIndex].targetRequired !== undefined &&
		storageCache.commandList[storageCache.currentCmdIndex].targetRequired === "false"
	) {
		targetRequired = false;
	}

	// Check if the command has moved <target> to be replaced:
	if (command.indexOf("<target>") >= 0) {
		// Check for target replacement:
		command = command.replace("<target>", storageCache.target, "g");
	} else if (targetRequired) {
		// Tack target onto the end by default:
		command += " " + storageCache.target;
	}

	return command;
}

/**
 * Check data from the server to determine if it satisfies the parse requirements
 * for the current command in commandList. If matched it will set the value of
 * currentMoveNextWhen (identifies the trigger to run the next command).
 */
function matchExpectedParse(data) {
	if (storageCache.commandList.length < 1) {
		consoleLog("CommandList is empty... stop running?");
		return false;
	}

	let matchFound = false;
	const parse = storageCache.commandList[storageCache.currentCmdIndex].parse;

	// If the expected parse check is an array, check each:
	if (Array.isArray(parse)) {
		for (var i = 0; i < parse.length; i++) {
			if (matchOutcome(data, parse[i].outcome)) {
				matchFound = true;
				if (parse[i].moveNextNow) {
					storageCache.moveNextNow = true;
				}
				// Set value to detect for moving onto the next command:
				storageCache.currentMoveNextWhen = parse[i].moveNextWhen;
				break;
			}
		}
	} else {
		if (matchOutcome(data, parse.outcome)) {
			matchFound = true;
			if (parse.moveNextNow) {
				storageCache.moveNextNow = true;
			}
			// Set value to detect for moving onto the next command:
			storageCache.currentMoveNextWhen = parse.moveNextWhen;
		}
	}

	return matchFound;
}

function matchOutcome(data, outcome) {
	// Support a pipe delimeter for outcome strings.
	const outcomeSplit = outcome.split("|").map(function (item) {
		return item.trim();
	});

	return outcomeSplit.some((outcome) => data.indexOf(outcome) >= 0);
}

/*********************************************************************************************/
/** Utility **/

const delay = (function () {
	var timer = 0;
	return function (callback, ms) {
		clearTimeout(timer);
		timer = setTimeout(callback, ms);
	};
})();

function getCommandDelayInMs(additionalDelay) {
	// Between 900 and 1100 miliseconds
	let commandDelay = Math.floor(Math.random() * 200) + 900;

	if (additionalDelay) {
		commandDelay += additionalDelay;
	}

	return commandDelay;
}

function dedent(callSite, ...args) {
	function format(str) {
		let size = -1;
		return str.replace(/\n(\s+)/g, (m, m1) => {
			if (size < 0) size = m1.replace(/\t/g, "    ").length;

			return "\n" + m1.slice(Math.min(m1.length, size));
		});
	}

	if (typeof callSite === "string") {
		return format(callSite);
	}

	if (typeof callSite === "function") {
		return (...args) => format(callSite(...args));
	}

	let output = callSite
		.slice(0, args.length + 1)
		.map((text, i) => (i === 0 ? "" : args[i - 1]) + text)
		.join("");

	return format(output);
}

function stringToBoolean(string) {
	switch (string.toLowerCase().trim()) {
		case "true":
		case "yes":
		case "1":
			return true;
		case "false":
		case "no":
		case "0":
		case null:
			return false;
		default:
			return Boolean(string);
	}
}

/**
 *  Handle slash commands that are received from the game client.
 */
function slashCommand(command) {
	const commandParams = command.split(/\s+/);
	const commandName = commandParams[0];

	switch (commandName) {
		case "/help":
			sendClientMessage(
				dedent(`
					Here are the available commands:
					/scripts |> List of currently defined scripts
					/editscripts |> Open the edit scripts window
					/current |> Display the currently running script
					/start [scriptName] [target] [weaponItemName] *[shouldKill] *[continueOnWalkIn] |> Start a script by name; * = optional (defaults to true)
					/stop |> Stop the currently running script
					/repeat [command] |> Repeats a given command with a random delay inbetween each attempt
					/repeatnlb [command] |> Repeats a given command, expects 'No longer busy' inbetween
					/pause |> Pause the current script
					/resume |> Resume the current script
					`)
			);
			break;
		case "/scripts":
			const scripts = userScripts
				.map((s) => s.scriptName)
				.toString()
				.replace(/,/g, "\r\n");

			sendClientMessage(
				dedent(
					`Here are the names of available scripts:
							${scripts}`
				)
			);
			break;
		case "/editscripts":
			openEditScripts();
			break;
		case "/current":
			sendClientMessage(`The current script is: ${storageCache.currentScriptName}`);
			break;
		case "/start":
			// Remove empty param option if found
			if (commandParams.includes("")) {
				commandParams.splice(commandParams.indexOf(""), 1);
			}

			if (commandParams.length <= 1) {
				sendClientMessage(
					`A script name parameter is expected when using /scripts`
				);
			}

			const scriptName = commandParams[1];
			const target = commandParams[2];
			const weaponItemName = commandParams[3];
			let shouldKill = null;
			let continueOnWalkIn = null;

			if (commandParams.length >= 5) {
				shouldKill = stringToBoolean(commandParams[4]);
			}
			if (commandParams.length >= 6) {
				continueOnWalkIn = stringToBoolean(commandParams[5]);
			}

			const script = userScripts.find((s) => {
				return s.scriptName.toLowerCase() === scriptName.toLowerCase();
			});

			if (!script) {
				sendClientMessage(`Script not found.`);
			}

			runScriptByName(scriptName, {
				target: target,
				weaponItemName: weaponItemName,
				shouldKill: shouldKill,
				continueOnWalkIn: continueOnWalkIn,
			});
			storageCache.lastCommandRan = command;
			break;
		case "/stop":
			killCurrentScript();
			break;
		case "/repeat":
			// Grab the entire command after the command name to use verbatim.
			const repeatParams = command.split("/repeat");
			if (repeatParams.length <= 1) {
				sendClientMessage(`A command to repeat is expected when using /repeat`);
			}

			const repeatCmd = repeatParams[1].trim();
			storageCache.scriptPaused = false;
			runSimpleRepeatWithDelay(repeatCmd);
			storageCache.lastCommandRan = command;
			sendClientMessage(`Starting to repeat the command: ${repeatCmd}`);
			break;
		case "/repeatnlb":
			// Grab the entire command after the command name to use verbatim.
			const repeatNlbParams = command.split("/repeatnlb");
			if (repeatNlbParams.length <= 1) {
				sendClientMessage(
					`A command to repeat is expected when using /repeatnlb`
				);
			}

			const repeatNlbCmd = repeatNlbParams[1].trim();
			storageCache.scriptPaused = false;
			runSimpleRepeat(repeatNlbCmd);
			storageCache.lastCommandRan = command;
			sendClientMessage(`Starting to repeat the command: ${repeatNlbCmd}`);
			break;
		case "/pause":
			pauseCurrentScript();
			break;
		case "/resume":
			resumeCurrentScript();
			break;
		default:
			sendClientMessage(`Slash command ${command} not found.`);
	}
}

function getRunningCommand() {
	let runningCmd = "";

	if (storageCache.currentScriptName) {
		runningCmd = `Script - ${storageCache.currentScriptName}`;
	} else {
		runningCmd = storageCache.lastCommandRan;
	}

	return runningCmd;
}

function consoleLog(message, shouldColor = true) {
	console.log(
		`%c${message}`,
		shouldColor ? "color: darkred; background: yellow;" : ""
	);
}

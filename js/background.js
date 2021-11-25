/*
		This is the background script used to house features global to the extension.
		Communication to and from the content/injected scripts gets handled here.
*/

/*********************************************************************************************/

const bkg = chrome.extension.getBackgroundPage();
bkgConsoleLog("background.js initialized...");

// Chrome
const targetTabTitle = "The Eternal City - Orchil (Beta) - Skotos";
const targetTabUrl = "http://client.eternalcitygame.com/tec/tec.htm";

// Simple repeat
let runRepeat = false;
let repeatCommand = null;

// Repeat constantly with a delay
let runRepeatWithDelay = false;
let repeatWithDelayCommand = null;

// General
let target = null;
let commandList = [];
let currentCmdIndex = 0;
let currentMoveNextWhen = null;
let moveNextNow = false;
let commandOverride = null;
let lastCommandRan = null;

// Combat
let shouldKill = false;
let shouldKillParse = null;
let continueOnWalkIn = false;
let weaponItemName = null;
let addAttack = false;
let stance;

// Scripts
let scriptPaused = false;
let currentScriptName = null;
let currentScriptType = null;
let currentScripts = null;
let currentScript = null;
function getCurrentScripts() {
	return currentScripts;
}

/*********************************************************************************************/
/* Extension setup and Chrome things */

/**
 * Setup popout window
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

/**
 * Load scripts from scriptCollection or local storage:
 */
function loadScripts() {
	chrome.storage.local.get("userScripts", function (data) {
		if (data && data["userScripts"]) {
			currentScripts = data["userScripts"];
		} else {
			fetch("/scripts/scriptCollection.json")
				.then((res) => res.json())
				.then((out) => {
					if (out) {
						currentScripts = out;
						chrome.storage.local.set({ userScripts: out }, function () {
							return false;
						});
					}
				});
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
		chrome.storage.local.set({ userScripts: scripts }, function () {
			return false;
		});

		// Send message to popup that currentScripts have been updated:
		chrome.runtime.sendMessage({
			msg: "reload-scripts-select",
		});
	}
}

// Open popout window when the main extension icon is clicked:
chrome.browserAction.onClicked.addListener(function (tab) {
	openPopupWindow(tab);
});

// Initial script load:
loadScripts();

/*********************************************************************************************/
/** Communication with content scripts to send/receive messages to/from the game **/

/**
 *  Send a command to the content script, which will forward it to the injected script.
 */
function sendCommand(msg) {
	if (!msg) {
		bkgConsoleLog("sendCommand called with null or empty command");
		return;
	}

	bkgConsoleLog(`Command sent: ${msg}`);

	chrome.tabs.query({ url: targetTabUrl }, function (tabs) {
		if (tabs.length === 0) {
			bkgConsoleLog("Tab not found, url changed?");
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
			bkgConsoleLog("Tab not found, title changed?");
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
	bkgConsoleLog(data, false);

	if (scriptPaused === true) return;

	if (runRepeat) {
		if (data.indexOf("You are no longer busy.") >= 0) {
			setTimeout(function () {
				sendCommand(repeatCommand);
			}, getCommandDelayInMs());
			return;
		}
	}

	if (commandList.length > 0 && currentScriptType === "combat") {
		combatScript(data);
	} else if (commandList.length > 0 && currentScriptType === "nonCom") {
		nonComScript(data);
	}
}

// Open the edit scripts popup
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

// Listen for received messages from content.js (ultimately from injected.js)
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	// request.message.timestamp
	// request.message.data
	if (request.type == "tec-receive-message") {
		parseMessage(request.message.data);
	}
});

// Listen for received commands from content.js (ultimately from injected.js)
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (
		request.type == "tec-send-command" &&
		request.message.command !== "undefined"
	) {
		const cmdTrimmed = request.message.command.trim();
		if (cmdTrimmed.indexOf("/") === 0) {
			// Run the slash command
			slashCommand(cmdTrimmed);
		}
	}
});

// Listen for the command to open the edit scripts window from content.js (ultimately from injected.js)
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (
		request.type == "tec-edit-scripts" &&
		request.message.command !== "undefined"
	) {
		openEditScripts();
	}
});

/*********************************************************************************************/
/** Scripting: setting up and executing defined scripts **/

/**
 * Entry point for running a script:
 */
function runScriptByName(scriptName, options) {
	// Get the script object by name:
	const script = currentScripts.find((s) => {
		return s.scriptName.toLowerCase() === scriptName.toLowerCase();
	});

	if (!script) {
		bkgConsoleLog(`No script found matching name: ${scriptName}`);
	} else {
		killCurrentScript();
		sendClientMessage(
			`Starting script: ${scriptName} (${script.scriptFriendlyName})`
		);

		currentMoveNextWhen = "You are no longer busy";

		target = options.target || "";
		weaponItemName = options.weaponItemName || "";
		shouldKill =
			options.shouldKill !== null ? options.shouldKill : script.shouldKill;
		shouldKillParse = script.shouldKillParse;
		continueOnWalkIn =
			options.continueOnWalkIn !== null
				? options.continueOnWalkIn
				: script.continueOnWalkIn;
		addAttack = script.addAttack;
		stance = script.stanceCommand;
		currentScriptType = script.scriptType;
		currentScriptName = script.scriptName;
		currentScript = script;
		scriptPaused = false;

		script.commandList.forEach(function (command, index) {
			commandList.push(command);
		});

		// Kick it off...
		sendCommand(getFormattedCommand());
	}
}

function runSimpleRepeat(command) {
	killCurrentScript();
	runRepeat = true;
	repeatCommand = command;

	setTimeout(function () {
		sendCommand(command);
	}, getCommandDelayInMs());
}

function runSimpleRepeatWithDelay(command) {
	killCurrentScript();
	runRepeatWithDelay = true;
	repeatWithDelayCommand = command;

	var intr = setInterval(function () {
		if (!runRepeatWithDelay) clearInterval(intr);

		if (!scriptPaused && runRepeatWithDelay) sendCommand(command);
	}, 1000);
}

/**
 * Kill it with fire.
 */
function killCurrentScript() {
	if (currentScriptName || lastCommandRan) {
		sendClientMessage(`Stopping script: ${getRunningCommand()}`);
	}

	target = "";
	weaponItemName = "";
	shouldKill = false;
	shouldKillParse = "";
	runRepeat = false;
	repeatCommand = "";
	runRepeatWithDelay = false;
	repeatWithDelayCommand = "";
	commandList = [];
	addAttack = false;
	stance = "";
	commandOverride = "";
	currentCmdIndex = 0;
	currentMoveNextWhen = null;
	moveNextNow = false;
	currentScriptType = "";
	currentScriptName = "";
	currentscript = null;
	scriptPaused = false;
}

/**
 * Pause the current script
 */
function pauseCurrentScript() {
	scriptPaused = true;
	sendClientMessage(`Paused: ${getRunningCommand()}`);
}

/**
 * Resume the current script
 */
function resumeCurrentScript() {
	scriptPaused = false;
	sendNextCommand();
	sendClientMessage(`Resumed: ${getRunningCommand()}`);
}

/**
 * Used to parse and act on incoming game message data for combat scripts.
 */
function combatScript(data) {
	const matchFound = matchExpectedParse(data);

	if (matchFound) {
		if (currentCmdIndex === commandList.length - 1) {
			if (addAttack) {
				commandOverride = `att ${target}`;
			}
			// Reset
			currentCmdIndex = 0;
		} else {
			// Move the command list index forward...
			currentCmdIndex++;
		}

		// If the parse has moveNextNow set to true, or if currentMoveNextWhen
		// is null, send the next command now:
		if (moveNextNow || !currentMoveNextWhen) {
			// Delay to avoid commands being sent too close together.
			sendNextCommand(400);
			return;
		}
	}

	if (shouldKill) {
		// Override based on specific scenarios
		// TODO: Move this into something more dynamic.
		const runningAttack = currentScript.addAttack;
		if (
			data.indexOf("falls unconscious") >= 0 ||
			(commandOverride.indexOf("att") === -1 &&
				(data.indexOf("You hit") >= 0 || data.indexOf("You miss") >= 0))
		) {
			commandOverride = `kill ${target}`;
		}

		// Handle being stuck trying to kill something:
		if (data.indexOf("must be unconscious first") >= 0) {
			commandOverride = "";
			sendNextCommand();
		}

		// Detect weapon-specific kill echo and wipe the override for next no longer busy.
		if (
			data.indexOf(shouldKillParse) >= 0 &&
			commandOverride.indexOf("kill") >= 0
		) {
			commandOverride = "";
		}
	}

	// Attempt to continue script after a critter/target walks in/arrives.
	if (continueOnWalkIn) {
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
		currentMoveNextWhen &&
		currentMoveNextWhen.length > 0 &&
		data.indexOf(currentMoveNextWhen) >= 0
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
		commandOverride.indexOf("att") >= 0 &&
		(data.indexOf("You hit") >= 0 || data.indexOf("You miss") >= 0)
	) {
		commandOverride = "";
	}

	// Handle sweeped/knocked down after failed attack attempt:
	if (data.indexOf("You must be standing") >= 0) {
		setTimeout(function () {
			sendCommand("stand");
		}, getCommandDelayInMs());
	}

	// Handle fumble or disarm:
	if (data.indexOf("You fumble! You drop a") >= 0) {
		// Just set override since fumble requires waiting for no longer busy anyway.
		commandOverride = `take ${weaponItemName}`;
	}
	if (data.indexOf("You take a") >= 0) {
		sendDelayedCommands([
			`wield ${weaponItemName}`,
			`${commandList[currentCmdIndex].command} ${target}`,
		]);
	}
	if (data.indexOf("You can't do that right now") >= 0) {
		sendDelayedCommands([
			`get ${weaponItemName}`,
			`wield ${weaponItemName}`,
			`${commandList[currentCmdIndex].command} ${target}`,
		]);
	}
	if (data.indexOf("You must be carrying something to wield it") >= 0) {
		sendDelayedCommands([
			`get ${weaponItemName}`,
			`wield ${weaponItemName}`,
			`${commandList[currentCmdIndex].command} ${target}`,
		]);
	}
	if (data.indexOf("You must be wielding your weapon in two hands") >= 0) {
		sendDelayedCommands([
			`wield ${weaponItemName}`,
			`${commandList[currentCmdIndex].command} ${target}`,
		]);
	}

	// Handle entagled weapon
	if (data.indexOf("You cannot attack with an entangled weapon") >= 0 
		|| data.indexOf("You cannot use that action while grappling") >= 0) {
		sendDelayedCommands([
			`free`,
			`${commandList[currentCmdIndex].command} ${target}`,
		]);
	}

	// Handle distance/approaching
	if (data.indexOf("is not close enough") >= 0) {
		sendDelayedCommands([
			`app ${target}`,
			commandOverride
				? commandOverride
				: `${commandList[currentCmdIndex].command} ${target}`,
		]);
	}

	// Handle stance when not auto:
	if (data.indexOf("You are not in the correct stance") >= 0) {
		if (stance) {
			sendDelayedCommands([stance]);
		}
	}
}

/**
 * Used to parse and act on incoming game message data for nonCombat scripts.
 */
function nonComScript(data) {
	const matchFound = matchExpectedParse(data);
	if (matchFound) {
		if (currentCmdIndex === commandList.length - 1) {
			// Reset
			currentCmdIndex = 0;
		} else {
			// Move the command list index forward...
			currentCmdIndex++;
		}

		// If the parse has moveNextNow set to true, or if  currentMoveNextWhen is null, send the next command now:
		if (moveNextNow || !currentMoveNextWhen) {
			// Delay to avoid commands being sent too close together.
			sendNextCommand(400);
			return;
		}
	}

	// Main work for nonCom loop:
	if (
		currentMoveNextWhen &&
		currentMoveNextWhen.length > 0 &&
		data.indexOf(currentMoveNextWhen) >= 0
	) {
		sendNextCommand();
	}
}

/**
 * Send the next command on the commandList.
 */
function sendNextCommand(additionalDelay) {
	if (!shouldSendNextCommand()) {
		bkgConsoleLog(`shouldSendNextCommand was false, don't send command.`);
		return;
	}

	const commandDelayInMs = getCommandDelayInMs(additionalDelay);

	bkgConsoleLog("commandDelayInMs: " + commandDelayInMs);

	setTimeout(function () {
		// Set override or use current command value:
		let nextCommand;

		if (commandOverride) {
			nextCommand = commandOverride;
		} else {
			nextCommand = getFormattedCommand();
		}

		sendCommand(nextCommand);

		// Reset to a default here now to prevent it from sending back to back commands.
		currentMoveNextWhen = "You are no longer busy";
		moveNextNow = false;
	}, commandDelayInMs);
}

/**
 * Determine whether or not we should send the next command. Special rules apply.
 */
function shouldSendNextCommand() {
	var sendCommand = true;

	if (runRepeatWithDelay) sendCommand = false;

	return sendCommand;
}

/**
 * Send a list of commands with an offset belay between them.
 */
function sendDelayedCommands(commands) {
	if (commands && commands.length > 0) {
		const offsetMs = 1000;
		commands.forEach(function (command, index) {
			setTimeout(function () {
				sendCommand(command);
			}, offsetMs * (index + 2));
		});
		// This may cause bugs... but for now.
		commandOverride = "";
	}
}

/**
 * Replace expected special sequences in a command string with the appropriate
 * values from script variables. This will likely become more robust over time.
 */
function getFormattedCommand() {
	if (commandList.length <= 0 || commandList[currentCmdIndex] === undefined)
		return "";

	let command = commandList[currentCmdIndex].command;
	let targetRequired = true;

	// If there is a value present for targetRequired, and it is false, then don't add a target.
	if (
		commandList[currentCmdIndex].targetRequired !== undefined &&
		commandList[currentCmdIndex].targetRequired === "false"
	) {
		targetRequired = false;
	}

	// Check if the command has moved <target> to be replaced:
	if (command.indexOf("<target>") >= 0) {
		// Check for target replacement:
		command = command.replace("<target>", target, "g");
	} else if (targetRequired) {
		// Tack target onto the end by default:
		command += " " + target;
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
		bkgConsoleLog("CommandList is empty... stop running?");
		return false;
	}

	let matchFound = false;
	const parse = commandList[currentCmdIndex].parse;

	// If the expected parse check is an array, check each:
	if (Array.isArray(parse)) {
		for (var i = 0; i < parse.length; i++) {
			if (matchOutcome(data, parse[i].outcome)) {
				matchFound = true;
				if (parse[i].moveNextNow) {
					moveNextNow = true;
				}
				// Set value to detect for moving onto the next command:
				currentMoveNextWhen = parse[i].moveNextWhen;
				break;
			}
		}
	} else {
		if (matchOutcome(data, parse.outcome)) {
			matchFound = true;
			if (parse.moveNextNow) {
				moveNextNow = true;
			}
			// Set value to detect for moving onto the next command:
			currentMoveNextWhen = parse.moveNextWhen;
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

	if (typeof callSite === "string") return format(callSite);

	if (typeof callSite === "function")
		return (...args) => format(callSite(...args));

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
			const scripts = currentScripts
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
			sendClientMessage(`The current script is: ${currentScriptName}`);
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

			const script = currentScripts.find((s) => {
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
			lastCommandRan = command;
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
			scriptPaused = false;
			runSimpleRepeatWithDelay(repeatCmd);
			lastCommandRan = command;
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
			scriptPaused = false;
			runSimpleRepeat(repeatNlbCmd);
			lastCommandRan = command;
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

	if (currentScriptName) {
		runningCmd = `Script - ${currentScriptName}`;
	} else {
		runningCmd = lastCommandRan;
	}

	return runningCmd;
}

function bkgConsoleLog(message, shouldColor = true) {
	bkg.console.log(
		`%c${message}`,
		shouldColor ? "color: darkred; background: yellow;" : ""
	);
}

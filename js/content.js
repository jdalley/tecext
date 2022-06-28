/*********************************************************************************************/
/* Main script that contains primary logic for parsing and scripting. */

/*********************************************************************************************/
/* Initialization and Chrome setup */

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
let shieldItemName = null;
let addAttack = false;
let stance = null;
// Scripts
let scriptPaused = false;
let currentScriptName = null;
let currentScriptType = null;
let currentScript = null;

// Store scripts separately from the cache due to potential size
let userScripts = null;

// Configuration used to set options for the extension, controlled in the popup.
let extConfig = null;

// Load data from background service worker (local storage): user scripts and config
function loadExtData() {
	// Load scripts:
	chrome.runtime.sendMessage(
		{ type: "background-get-user-scripts" },
		function (response) {
			// response will be an array of script objects
			userScripts = response;
		}
	);

	// Load config:
	chrome.runtime.sendMessage(
		{ type: "background-get-configuration" },
		function (response) {
			// response will be an object with properties
			extConfig = response;

			applyConfiguration(extConfig);
		}
	);
}

/**
 *  Send the configuration to the injected script to apply it to the client page.
 */
function applyConfiguration(config) {
	document.dispatchEvent(
		new CustomEvent("extensionApplyConfig", {
			detail: {
				data: config,
			},
		})
	);
}

/**
 *  Save scripts here and in local storage via the background service worker
 * @param {string} scripts
 */
function saveScripts(scripts) {
	userScripts = scripts;
	chrome.runtime.sendMessage({
		type: "background-save-user-scripts",
		message: scripts,
	});
}

/**
 * Save configuration here and in local storage via the background service worker
 */
function saveConfiguration(config) {
	extConfig = config;
	applyConfiguration(extConfig);
	chrome.runtime.sendMessage({
		type: "background-save-configuration",
		message: config,
	});
}

/**
 * Inject the script used to work directly with the contents of the page; hooking into
 * relevant events, variables, and data from web sockets.
 */
const script = document.createElement("script");
script.src = chrome.runtime.getURL("js/injected.js");
(document.head || document.documentElement).appendChild(script);
script.onload = function () {
	script.remove();
};

/**
 * Load scripts once from the root
 */
loadExtData();

/*********************************************************************************************/
/** Communication with other scripts **/

// Listen for received messages from the injected script
document.addEventListener("tecReceiveMessage", function (e) {
	// e.detail.timestamp
	// e.detail.data
	parseMessage(e.detail.data);
});

// Listen for received commands from the injected script
document.addEventListener("tecSendCommand", function (e) {
	const cmdTrimmed = e.detail.command.trim();
	if (cmdTrimmed.indexOf("/") === 0) {
		// Run the slash command
		slashCommand(cmdTrimmed);
	}
});

// Listen for in-page UI related commands from the injected script
document.addEventListener("tecUICommand", function (e) {
	switch (e.detail.command) {
		case "openEditScripts":
			// Open the edit-scripts popup
			openEditScripts();
			break;
		default:
	}
});

/**
 *  Send a command to the injected script
 * @param {string} msg
 */
function sendCommand(msg) {
	if (!msg) {
		consoleLog("sendCommand called with null or empty command");
		return;
	}

	consoleLog(`command sent: ${msg}`);

	// Send message to the injected script
	document.dispatchEvent(
		new CustomEvent("tecSendMessage", {
			detail: {
				timestamp: new Date().toISOString(),
				data: msg,
			},
		})
	);

	return;
}

// Listener for messages from injected.js, popup.js, and jsoneditor.js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	switch (request.type) {
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
			}
			break;

		// Start script by name with options from popup
		case "popup-run-script":
			if (request.message.scriptName) {
				runScriptByName(request.message.scriptName, request.message);
			}
			break;

		// Kill script from popup
		case "popup-kill-script":
			killCurrentScript();
			break;

		// Pause script from popup
		case "popup-pause-script":
			pauseCurrentScript();
			break;

		// Resume script from popup
		case "popup-resume-script":
			resumeCurrentScript();
			break;

		// Return userScripts to the popup
		case "popup-get-scripts":
			sendResponse(userScripts);
			break;

		case "popup-save-configuration":
			saveConfiguration(request.message);
			break;

		case "popup-get-configuration":
			sendResponse(extConfig);
			break;

		// Return userScripts to the JSON editor
		case "editor-get-scripts":
			sendResponse(userScripts);
			break;

		// Save changes to userScripts from the JSON editor
		case "editor-set-scripts":
			if (request.message) {
				consoleLog(`saving scripts from JSON editor...`);
				saveScripts(request.message);
			}
			break;

		default:
			consoleLog(`listener couldn't process request type: ${request.type}`);
			break;
	}
});

/**
 * Send message to the client output
 * @param {string} msg
 */
function sendClientMessage(msg) {
	// Add message to output
	const output = document.getElementById("output");
	const div = document.createElement("div");
	const text = document.createTextNode(`\r\n${msg}`);

	div.appendChild(text);
	div.style.color = "red";
	div.style.fontSize = "smaller";
	output.appendChild(div);

	// scroll to bottom
	output.scrollTop = output.scrollHeight;
}

/**
 * Open the edit scripts popup
 */
function openEditScripts() {
	chrome.runtime.sendMessage({ type: "background-open-edit-scripts" });
}

/*********************************************************************************************/
/** Parsing and Scripting: setting up and executing defined scripts **/

/**
 * Entry point for figuring out what to do with messages received from the server
 * @param {string} data
 */
function parseMessage(data) {
	// Uncomment to dump data from server to the console
	//consoleLog(data, false);

	if (scriptPaused === true) {
		return;
	}

	// Handle running the simple repeat command
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

/**
 * Used to parse and act on incoming game message data for combat scripts
 * @param {string} data
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
 * Attempt to handle scenarios where you're unable to hit something due to range.
 * Often you're approached by multiple enemies at once in these cases, and you 
 * can't kill something easily with a script in this scenario. Therefore, we
 * want to try and optimistically pick the next target to try and hit that's 
 * close ranged. Additionally, we need to handle resetting the target as things
 * die.
 * @param {string} data 
 */
function combatHandleOutOfRange(data) {

	/*
		Here is what we get back in a single `block` from the server when we use the
		command `ac <target>`, ie: `ac man|rat`:

		</pre><pre><font size=+1><b>Checking the approach status of &quot;man|rat&quot;</b></font></font>
		<hr>
		1: a dirt-caked man with milky-white eyes and greasy hair(unconscious)
		2: a gaunt rat with milky-white eyes (engaging) 
		3: a filthy man with milky-white eyes and pale skin (engaging) 
		<hr>
		</pre>

		Regex psuedo:
		- Starts with a number and a :, ends with (engaging). Capture the group between the two.
		- After capture, use the first one found (first (engaging));

		Steps:
		0. Move any other out of range related code into this function to handle it centrally.
		1. When you get the message: `You'll have to retreat first`, it's time to switch targets.
		2. Run the `ac ${target}` command, and parse the output to find the first (lowest number)
		target on the list that is (engaging). 
		3. Add a new variable to track ${targetOverride}, and add support in the main attack loop
		targeting code.
		4. Determine when to reset ${targetOverride} (set it to ''); likely when you get the message
		`There aren't that many there.` or `You can't`.
		5. Add support in command parsing to handle having a number before a target, ie: `2 man|rat`.
	*/
	
} 

/**
 * Collection of parses to handle various scenarios that come up during combat.
 * These scenarios require special commands or responses.
 * TODO: These checks should probably be moved into a configurable area.
 * @param {string} data
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

	// Handle continuing after being stunned:
	if (data.indexOf("You are no longer stunned") >= 0) {
		sendNextCommand();
	}

	// Handle fumble or disarm:
	if (data.indexOf("You fumble! You drop a" || data.indexOf("You fumble, dropping")) >= 0) {
		// Just set override since fumble requires waiting for no longer busy anyway.
		if (data.indexOf(weaponItemName) >= 0) {
			commandOverride = `take ${weaponItemName}`;
		}
		else if (shieldItemName && data.indexOf(shieldItemName) >= 0) {
			commandOverride = `take ${shieldItemName}`;
		}
	}
	if (data.indexOf("You take a") >= 0) {
		let cmds = [];
		if (data.indexOf(weaponItemName) >= 0) {
			cmds.push(`wield ${weaponItemName}`)
		}
		else if (shieldItemName && data.indexOf(shieldItemName) >= 0) {
			cmds.push(`wield ${shieldItemName}`);
		}
		cmds.push(getFormattedCommand());
		sendDelayedCommands(cmds);
	}
	if (data.indexOf("You can't do that right now") >= 0) {
		let cmds = [`get ${weaponItemName}`, `wield ${weaponItemName}`];
		if (shieldItemName) {
			cmds.push(`get ${shieldItemName}`);
			cmds.push(`wield ${shieldItemName}`);
		}
		cmds.push(getFormattedCommand());
		sendDelayedCommands(cmds);
	}
	if (data.indexOf("You must be carrying something to wield it") >= 0) {
		let cmds = [`get ${weaponItemName}`, `wield ${weaponItemName}`];
		if (shieldItemName) {
			cmds.push(`get ${shieldItemName}`);
			cmds.push(`wield ${shieldItemName}`);
		}
		cmds.push(getFormattedCommand());
		sendDelayedCommands(cmds);
	}
	if (data.indexOf("You must be wielding your weapon in two hands") >= 0) {
		sendDelayedCommands([`wield ${weaponItemName}`, getFormattedCommand()]);
	}

	if (data.indexOf("You must be wielding a shield to") >= 0) {
		sendDelayedCommands([
			`get ${shieldItemName}`,
			`wield ${shieldItemName}`,
			getFormattedCommand(),
		]);
	}

	// Handle entagled weapon
	if (
		data.indexOf("You cannot attack with an entangled weapon") >= 0 ||
		data.indexOf("You cannot use that action while grappling") >= 0 ||
		data.indexOf("You are unable to do that,") >= 0
	) {
		sendDelayedCommands([`free`, getFormattedCommand()]);
	}

	// Handle distance/approaching
	if (data.indexOf("is not close enough") >= 0) {
		sendDelayedCommands([
			`engage ${target}`,
			commandOverride ? commandOverride : getFormattedCommand(),
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
 * @param {string} data
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
 * Entry point for running a script:
 * @param {string} scriptName
 * @param {Object} options
 */
function runScriptByName(scriptName, options) {
	// Get the script object by name:
	const script = userScripts.find((s) => {
		return s.scriptName.toLowerCase() === scriptName.toLowerCase();
	});

	if (!script) {
		consoleLog(`no script found matching name: ${scriptName}`);
	} else {
		killCurrentScript();
		sendClientMessage(
			`Starting script: ${scriptName} (${script.scriptFriendlyName})`
		);

		currentMoveNextWhen = "You are no longer busy";

		target = options.target || "";
		weaponItemName = options.weaponItemName || "";
		shieldItemName = options.shieldItemName || "";
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

/**
 * Repeat a command while waiting for "You are no longer busy"
 * @param {string} command
 */
function runSimpleRepeat(command) {
	// If runRepeat isn't true (not already the current script), we can set it up.
	// This allows us to call the function again to start it after a pause, without
	// re-running kill script and re-setting variables.
	if (!runRepeat) {
		killCurrentScript();
		// This variable is used in the parseMessage function to repeat the command.
		runRepeat = true;
		repeatCommand = command;
		lastCommandRan = command;
	}

	setTimeout(function () {
		sendCommand(command);
	}, getCommandDelayInMs());
}

/**
 * Repeat a command with a delay in between each repetition
 * @param {string} command
 */
function runSimpleRepeatWithDelay(command) {
	killCurrentScript();
	runRepeatWithDelay = true;
	repeatWithDelayCommand = command;
	lastCommandRan = command;

	var intr = setInterval(function () {
		if (!runRepeatWithDelay) {
			clearInterval(intr);
		}
		if (!scriptPaused && runRepeatWithDelay) {
			sendCommand(command);
		}
	}, 1000);
}

/**
 * Kill it with fire (reset all state for the currently configured script)
 */
function killCurrentScript() {
	if (currentScriptName || lastCommandRan) {
		sendClientMessage(`Stopping script: ${getRunningCommand()}`);
	}

	target = "";
	weaponItemName = "";
	shieldItemName = "";
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
	currentScript = null;
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

	// Start the repeat again if it's the active script, don't need to
	// pass a command as it's active and variables are already set.
	if (runRepeat) {
		runSimpleRepeat();
	} else {
		// Regular script, send the command.
		sendNextCommand();
	}

	sendClientMessage(`Resumed: ${getRunningCommand()}`);
}

/**
 * Send the next command on the commandList
 * @param {number} additionalDelay
 */
function sendNextCommand(additionalDelay) {
	if (!shouldSendNextCommand()) {
		consoleLog(`shouldSendNextCommand was false, don't send command.`);
		return;
	}

	const commandDelayInMs = getCommandDelayInMs(additionalDelay);

	consoleLog("commandDelayInMs: " + commandDelayInMs);

	setTimeout(function () {
		// Set override or use current command value:
		sendCommand(getFormattedCommand());

		// Reset to a default here now to prevent it from sending back to back commands
		currentMoveNextWhen = "You are no longer busy";
		moveNextNow = false;
	}, commandDelayInMs);
}

/**
 * Determine whether or not we should send the next command. Special rules apply
 */
function shouldSendNextCommand() {
	var sendCommand = true;

	// Only rule, for now.
	if (runRepeatWithDelay) {
		sendCommand = false;
	}
	return sendCommand;
}

/**
 * Send a list of commands with an offset belay between them
 * @param {Array} commands
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
	if (commandList.length <= 0 || commandList[currentCmdIndex] === undefined) {
		return "";
	}

	let command = "";

	// If we have a temporary command override, apply it.
	if (commandOverride) {
		command = commandOverride;
	} else {
		command = commandList[currentCmdIndex].command;
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
	}

	return command;
}

/**
 * Check data from the server to determine if it satisfies the parse requirements
 * for the current command in commandList. If matched it will set the value of
 * currentMoveNextWhen (identifies the trigger to run the next command).
 * @param {string} data
 */
function matchExpectedParse(data) {
	if (commandList.length < 1) {
		consoleLog("commandList is empty... stop running?");
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

/**
 * Check if a given set of data contains any of the expected outcome.
 * Handles splitting outcome by a pipe delimiter to check all values separately.
 * @param {string} data
 * @param {string} outcome
 * @returns
 */
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

/**
 * Get a somewhat random delay in miliseconds
 * @param {number} additionalDelay This amount will be added onto the random delay
 * @returns
 */
function getCommandDelayInMs(additionalDelay) {
	// Between 900 and 1100 miliseconds
	let commandDelay = Math.floor(Math.random() * 200) + 900;

	if (additionalDelay) {
		commandDelay += additionalDelay;
	}

	return commandDelay;
}

/**
 * Remove indent from template strings, borrowed from:
 * https://gist.github.com/zenparsing/5dffde82d9acef19e43c
 * @param {string} callSite
 * @param  {...any} args
 * @returns String without indentation
 */
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
 * Handle slash commands that are received from the game client.
 * @param {string} command The incoming command to act upon.
 */
function slashCommand(command) {
	const commandParams = command.split(/\s+/);
	const commandName = commandParams[0];

	switch (commandName) {
		case "/help":
			sendClientMessage(
				dedent(`
					Command notes:
					- [] denotes a command argument
					- *[] denotes a boolean argument that's optional (default is true) 
					Available commands:
					- List of currently defined scripts: /scripts
					- Open the edit scripts window: /editscripts 
					- Display the currently running script: /current
					- Start a script by name: /start [scriptName] [target] [weaponItemName] [shieldItemName] *[shouldKill] *[continueOnWalkIn]
					- Stop the currently running script: /stop
					- Repeat a command with a delay: /repeat [command]
					- Repeat a command after 'No longer busy': /repeatnlb [command]
					- Pause the current script: /pause 
					- Resume the current script: /resume
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
			const shieldItemName = commandParams[4];
			let shouldKill = null;
			let continueOnWalkIn = null;

			if (commandParams.length >= 5) {
				shouldKill = stringToBoolean(commandParams[5]);
			}
			if (commandParams.length >= 6) {
				continueOnWalkIn = stringToBoolean(commandParams[6]);
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
				shieldItemName: shieldItemName,
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

/**
 * Get the name of the currently running command or script.
 */
function getRunningCommand() {
	let runningCmd = "";

	if (currentScriptName) {
		runningCmd = `Script - ${currentScriptName}`;
	} else {
		runningCmd = lastCommandRan;
	}

	return runningCmd;
}

/**
 * Send a coloured message to the console (yellow background, dark red text)
 * @param {string} message The message to send to the console
 * @param {boolean} shouldColor Should output be coloured? Defaults to true
 */
function consoleLog(message, shouldColor = true) {
	console.log(
		`%c${message}`,
		shouldColor ? "color: darkred; background: yellow;" : ""
	);
}

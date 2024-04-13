import { isPositiveNumeric } from "./utils.js";

/*********************************************************************************************/
/* Main script that contains primary logic for parsing and scripting. */

/*********************************************************************************************/
/* Initialization and Chrome setup */

// Simple repeat
let repeatCommand = null;
let runRepeat = false;
// Repeat constantly with a delay
let repeatWithDelayCommand = null;
let runRepeatWithDelay = false;
// General
let currentCmdIndex = 0;
let currentMoveNextWhen = null;
let commandList = [];
let commandOverride = null;
let defaultCommandDelayMin = 900;
let defaultCommandDelayMax = 1100;
let defaultCommandRetryMs = 60000;
let delayNextCommandBy = 0;
let lastCommandRan = null;
let moveNextNow = false;
let target = null;
// Combat
let addAttack = false;
let advancingToKill = false;
let attemptingKill = false;
let continueOnWalkIn = false;
let shieldItemName = null;
let shouldKill = false;
let shouldKillParse = null;
let stance = null;
let entangledCommand = null;
let weaponItemName = null;
let recoveringWeapon = false;
// Scripts
let currentScript = null;
let currentScriptName = null;
let currentScriptType = null;
let scriptPaused = false;
let lastCommandSent = null;

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
script.src = chrome.runtime.getURL("injected.js");
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

	lastCommandSent = Date.now();

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
				scriptPaused = false;
				runSimpleRepeat(request.message);
				sendClientMessage(`Starting to repeat the command: ${request.message}`);
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
		if (data.includes("You are no longer busy.")) {
			setTimeout(function () {
				sendCommand(repeatCommand);
			}, getCommandDelayInMs());
			return;
		}
	}

	if (commandList.length > 0 && currentScriptType === "combat") {
		combatScript(data);
	} else if (commandList.length > 0 && currentScriptType === "noncom") {
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
		moveCombatCmdIndex();

		// If the parse has moveNextNow set to true, or if currentMoveNextWhen
		// is null, send the next command now:
		if (moveNextNow || !currentMoveNextWhen) {
			// Delay to avoid commands being sent too close together.
			sendNextCommand(400);
			return;
		}
	}

	// Handle scenarios where we need to stop trying the current command and move to the next.
	if (data.includes("You can't trip")) {
		moveCombatCmdIndex();
		// Delay to avoid commands being sent too close together.
		sendNextCommand(850);
		return;
	}

	if (shouldKill) {
		// Override based on specific scenarios.
		if (
			data.includes("falls unconscious") ||
			(attemptingKill &&
				(data.includes("You hit") || data.includes("You miss")))
		) {
			attemptingKill = true;
			commandOverride = `kill ${target}`;
		}

		// Handle being stuck trying to kill something.
		if (data.includes("must be unconscious first")) {
			commandOverride = "";
			attemptingKill = false;
			sendNextCommand();
		}

		// Handle resetting commandOverride after an `advance` attempt failure.
		if (extConfig.useMeleeAdvance && data.includes("You advance toward")) {
			if (advancingToKill) {
				commandOverride = `kill ${target}`;
				advancingToKill = false;
			} else {
				commandOverride = "";
			}
		}

		// Detect weapon-specific kill echo and wipe the override for next no longer busy.
		if (data.includes(shouldKillParse) && commandOverride.includes("kill")) {
			attemptingKill = false;
			commandOverride = "";
		}
	}

	// Attempt to continue script after a critter/target walks in/arrives.
	if (continueOnWalkIn) {
		if (
			data.includes("walks in") ||
			data.includes(" in from a") ||
			data.includes(" arrives.") ||
			data.includes(" charges in") ||
			data.includes(" charge in") ||
			data.includes(" rushes in") ||
			data.includes(" rush in") ||
			data.includes(" lopes in") ||
			data.includes(" and onto your boat" ||
			data.includes(" steps out of the nearby shadows."))
		) {
			sendNextCommand(400);
		}
	}

	// Handle coming out of a stun and continuing.
	if (data.includes("You are once again able to change combat postures")) {
		sendNextCommand();
	}

	// Check extra parses to react to.
	combatGlobals(data);

	// Main work for combat loop:
	if (
		currentMoveNextWhen &&
		currentMoveNextWhen.length > 0 &&
		data.includes(currentMoveNextWhen)
	) {
		sendNextCommand();
	}
}

/**
 * Move the currentCmdIndex forward or reset to the first index.
 */
function moveCombatCmdIndex() {
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
}

/**
 * Collection of parses to handle various scenarios that come up during combat.
 * These scenarios require special commands or responses.
 * TODO: These checks should probably be moved into a configurable area.
 * TODO: Rethink your life as these script parse -> reactions are getting
 * out of hand.
 * @param {string} data
 */
function combatGlobals(data) {
	// Handle addAttack commandOverride off-switch
	if (
		commandOverride.includes("att") &&
		(data.includes("You hit") || data.includes("You miss"))
	) {
		commandOverride = "";
	}

	// Handle sweeped/knocked down after failed attack attempt:
	if (
		data.includes("You must be standing") ||
		data.includes("You cannot do that right now") ||
		data.includes("You have disabled fighting while prone")
	) {
		let standCommand = extConfig.useBackwardsRiseToStand ? `brise` : `stand`;
		setTimeout(function () {
			sendCommand(standCommand);
		}, getCommandDelayInMs());
	}

	// Handle continuing after being stunned:
	if (data.includes("You are no longer stunned")) {
		sendNextCommand();
	}

	// Handle fumble or disarm:
	if (
		data.includes("You fumble! You drop a") ||
		data.includes("You fumble, dropping")
	) {
		// Just set override since fumble requires waiting for no longer busy anyway.
		if (data.includes(weaponItemName)) {
			commandOverride = `get ${weaponItemName}`;
			recoveringWeapon = true;
		} else if (shieldItemName && data.includes(shieldItemName)) {
			commandOverride = `get ${shieldItemName}`;
			recoveringWeapon = true;
		}
	}
	// Handle fumble+fall (brawling/pank)
	if (data.includes("You fumble, falling")) {
		commandOverride = `stand`;
	}

	// Continuation of the fumble handling after picking up the weapon/shield...
	if (
		(data.includes("You take a") ||
			data.includes("You are already carrying")) &&
		recoveringWeapon
	) {
		
		let cmds = [];
		if (data.includes(weaponItemName)) {
			cmds.push(`wield ${weaponItemName}`);
		} else if (shieldItemName && data.includes(shieldItemName)) {
			cmds.push(`wield ${shieldItemName}`);
		}
		// reset/remove `get {weapon/shield}`
		commandOverride = "";
		cmds.push(getFormattedCommand());
		sendDelayedCommands(cmds);

		recoveringWeapon = false;
	}
	// These not-wielding scenarios don't require waiting for no longer busy.
	if (data.includes("You can't do that right now")) {
		let cmds = [`get ${weaponItemName}`, `wield ${weaponItemName}`];
		if (shieldItemName) {
			cmds.push(`get ${shieldItemName}`);
			cmds.push(`wield ${shieldItemName}`);
		}
		cmds.push(getFormattedCommand());
		sendDelayedCommands(cmds);
	}
	if (
		data.includes("You must be carrying something to wield it") ||
		data.includes("You need to be wielding") ||
		data.includes("You must be wielding") ||
		data.includes("You are not wielding")
	) {
		let cmds = [`get ${weaponItemName}`, `wield ${weaponItemName}`];
		if (shieldItemName) {
			cmds.push(`get ${shieldItemName}`);
			cmds.push(`wield ${shieldItemName}`);
		}
		cmds.push(getFormattedCommand());
		sendDelayedCommands(cmds);
	}
	if (data.includes("You must be wielding your weapon in two hands")) {
		sendDelayedCommands([`wield ${weaponItemName}`, getFormattedCommand()]);
	}

	if (data.includes("You must be wielding a shield to")) {
		sendDelayedCommands([
			`get ${shieldItemName}`,
			`wield ${shieldItemName}`,
			getFormattedCommand(),
		]);
	}

	// Handle entagled weapon
	if (
		data.includes("You cannot attack with an entangled weapon") ||
		data.includes("You cannot attempt this maneuver with an entangled") ||
		data.includes("You cannot use that action while grappling") ||
		data.includes("You are unable to do that,") ||
		data.includes("You must be free of entanglements")
	) {
		// Use the script's custom entangledCommand ability, ie: Flinging Disarm.
		if (entangledCommand) {
			if (entangledCommand.includes("<weapon>")) {
				entangledCommand = entangledCommand.replaceAll(
					"<weapon>",
					weaponItemName
				);
			}
			// Not using sendDelayedCommands here as it wipes out `commandOverride`,
			// and can interfere with `kill` attempts.
			setTimeout(function () {
				sendCommand(entangledCommand);
			}, getCommandDelayInMs());
		} else {
			sendDelayedCommands([`free`, getFormattedCommand()]);
		}
	}

	// Handle distance/approaching
	if (data.includes("is not close enough")) {
		let engageCommand = `engage`;

		if (extConfig.useMeleeAdvance) {
			engageCommand = `advance`;
		}
		// If both useMeleeAdvance and useCustomApproach are enabled, use
		// custom approach.
		if (extConfig.useCustomApproach) {
			engageCommand = extConfig.customApproachCommand;
		}

		if (extConfig.useMeleeAdvance && commandOverride.includes("kill")) {
			// In combatScript, this is used to reset commandOverride to `kill` when
			// Melee Advance/Custom Approach is done successfully.
			advancingToKill = true;
		}
		// Not using sendDelayedCommands here as it wipes out `commandOverride`,
		// and can interfere with `kill` attempts.
		setTimeout(function () {
			sendCommand(`${engageCommand} ${target}`);

			if (engageCommand.includes("engage")) {
				setTimeout(function () {
					// Next attack as 'You attempt to engage <target>' doesn't have a round time.
					sendCommand(
						commandOverride ? commandOverride : getFormattedCommand()
					);
				}, getCommandDelayInMs(400));
			}
		}, getCommandDelayInMs());
	}
	// Handle failing to Melee Advance if it's toggled on
	if (extConfig.useMeleeAdvance && data.includes("but can't get close")) {
		if (commandOverride.includes("kill")) {
			// In combatScript, this is used to reset commandOverride to `kill` when
			// Melee Advance is done successfully.
			advancingToKill = true;
		}
		// Next No Longer Busy will advance the target
		commandOverride = `advance ${target}`;
	}
	// Handle being stuck trying to engage an already approached target, having
	// being too close to approach, or are already standing.
	if (
		data.includes("You are already engaging") ||
		data.includes("is too close.") ||
		data.includes("You are already standing")
	) {
		commandOverride = "";
		sendNextCommand(850);
	}

	// Handle the scenario where you're trying to attack/kill something that has
	// been pushed back/retreated.
	if (data.includes("You'll have to retreat first")) {
		// If melee advance is toggled on in config, use it.
		if (extConfig.useMeleeAdvance) {
			// Not using sendDelayedCommands here as it wipes out `commandOverride`,
			// and can interfere with `kill` attempts.
			setTimeout(function () {
				sendCommand(`advance ${target}`);
			}, getCommandDelayInMs());
		} else {
			// Best attempt to try to continue and see if the distance resolves itself.
			sendNextCommand();
		}
	}

	// Handle stance when not auto:
	if (data.includes("You are not in the correct stance")) {
		if (stance) {
			sendDelayedCommands([stance]);
		}
	}

	// Handle being stuck in berserk/defensive after stance-affecting maneuvers:
	if (
		data.includes("You are already in a berserk stance") ||
		data.includes("You are already in a defensive stance")
	) {
		sendDelayedCommands(["normal"]);
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
		data.includes(currentMoveNextWhen)
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
		entangledCommand = script.entangledCommand;
		currentScriptType = script.scriptType.toLowerCase();
		currentScriptName = script.scriptName;
		currentScript = script;
		scriptPaused = false;

		script.commandList.forEach(function (command, index) {
			commandList.push(command);
		});

		// Kick it off...
		sendNextCommand();
	}
}

/**
 * Repeat a command while waiting for "You are no longer busy"
 * @param {string} command
 */
function runSimpleRepeat(command) {
	if (!scriptPaused) {
		killCurrentScript();
	}
	// This variable is used in the parseMessage function to repeat the command.
	runRepeat = true;
	repeatCommand = command;
	lastCommandRan = command;

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

	consoleLog("killCurrentScript ran");

	target = "";
	weaponItemName = "";
	shieldItemName = "";
	recoveringWeapon = false;
	shouldKill = false;
	shouldKillParse = "";
	attemptingKill = false;
	runRepeat = false;
	repeatCommand = "";
	runRepeatWithDelay = false;
	repeatWithDelayCommand = "";
	commandList = [];
	addAttack = false;
	stance = "";
	entangledCommand = "";
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
	// Start the repeat again if it's the active script.
	if (runRepeat) {
		runSimpleRepeat(repeatCommand);
		scriptPaused = false;
	} else {
		scriptPaused = false;
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

	let commandDelayInMs = getCommandDelayInMs(additionalDelay);
	// Handle delaying this command given the previous command's delayBeforeNext value, if present.
	if (delayNextCommandBy > 0) {
		commandDelayInMs = delayNextCommandBy;
		// Reset the delay
		delayNextCommandBy = 0;
	}

	setTimeout(function () {
		// Set override or use current command value:
		sendCommand(getFormattedCommand());

		// Reset to a default here now to prevent it from sending back to back commands
		currentMoveNextWhen = "You are no longer busy";
		moveNextNow = false;

		// This numeric value, if it's configured for the current command in the commandList,
		// is intended to delay the script from moving onto the next command for a given
		// number of milliseconds.
		delayNextCommandBy = commandList[currentCmdIndex]?.delayBeforeNext ?? 0;
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
			!commandList[currentCmdIndex].targetRequired
		) {
			targetRequired = false;
		}

		// Check if the command has moved <target> to be replaced:
		if (command.includes("<target>")) {
			// Check for target replacement:
			command = command.replaceAll("<target>", target);
		} else if (targetRequired) {
			// Tack target onto the end by default:
			if (target) {
				command += ` ${target}`;
			}
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
		if (item.includes("<target>")) {
			// Check for target replacement:
			item = item.replaceAll("<target>", target);
		}
		return item.trim();
	});

	return outcomeSplit.some((outcome) => data.includes(outcome));
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
	let min = isPositiveNumeric(extConfig.commandDelayMin)
		? Number(extConfig.commandDelayMin)
		: defaultCommandDelayMin;
	let max = isPositiveNumeric(extConfig.commandDelayMax)
		? Number(extConfig.commandDelayMax)
		: defaultCommandDelayMax;
	let diff = max - min;

	// Fallback for an incorrectly defined range in config
	if (diff <= 0) {
		min = defaultCommandDelayMin;
		max = defaultCommandDelayMax;
		diff = max - min;
	}

	// Between configured min/max or defaults
	let commandDelay = Math.floor(Math.random() * diff) + min;

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
 * Constantly running function to check if it's been more than a
 * defined number of milliseconds since the last command was sent
 * while a script is running. If it has, send the next command to
 * kick things off again.
 */
(function(){
	let maxCmdDelay = isPositiveNumeric(extConfig?.commandDelayMax)
		? Number(extConfig.commandDelayMax)
		: defaultCommandDelayMax;

	// Min value to avoid sending too fast back to back.
	maxCmdDelay = maxCmdDelay < 1000
			? 1000
			: maxCmdDelay;

	if (commandList.length > 0 && !scriptPaused) {
		let retryMs = isPositiveNumeric(extConfig?.commandRetryMs)
			? Number(extConfig.commandRetryMs)
			: defaultCommandRetryMs;

		const timeDiff = Date.now() - lastCommandSent;
		// `0` effectively turns off the retry.
		if (retryMs > 0 && timeDiff > retryMs) {
			consoleLog(`${retryMs/1000} seconds since last command sent, sending next command.`);
			sendNextCommand();
		}
	}
	// Rerun timer buffered by configured max command delay.
	setTimeout(arguments.callee, maxCmdDelay);
})();

/**
 * Handle slash commands that are received from the game client.
 * @param {string} command The incoming command to act upon.
 */
function slashCommand(command) {
	// Get commands by separating on spaces, ignoring spaces within quotes.
	let commandParams = command.match(/"([^"]+)"|[^" ]+/g);
	// Replace quotes in resulting strings
	for (let i = 0, l = commandParams.length; i < l; i++) {
		commandParams[i] = commandParams[i].replace(/^"|"$/g, "");
	}

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

			if (commandParams.length >= 6) {
				shouldKill = stringToBoolean(commandParams[5]);
			}
			if (commandParams.length >= 7) {
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

import { State } from "./state.js";
import { 
	consoleLog, 
	dedent,
	dedentPreserveLayout,
	isPositiveNumeric, 
	stringToBoolean,
	getAuthHash
} from "./utils.js";
 
/*********************************************************************************************/
/* Main script that contains primary logic for parsing and scripting. */

/*********************************************************************************************/
/* Initialization and Chrome setup */

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
	state.userScripts = scripts;
	chrome.runtime.sendMessage({
		type: "background-save-user-scripts",
		message: scripts,
	});
}

/**
 * Save configuration here and in local storage via the background service worker
 */
function saveConfiguration(config) {
	state.extConfig = config;
	applyConfiguration(state.extConfig);
	chrome.runtime.sendMessage({
		type: "background-save-configuration",
		message: config,
	});
}

/**
 * Inject the script used to work directly with the contents of the page; hooking into
 * relevant events, variables, and data from web sockets.
 * 
 * The order of operations is important here. The injected script must be loaded before
 * the extension's configuration and user script data is loaded into State.
 */
const script = document.createElement("script");
script.src = chrome.runtime.getURL("injected.js");
(document.head || document.documentElement).appendChild(script);
script.onload = function () {
	script.remove();
};

// Load the extension's configuration and user script data into State.
const state = new State();
//.Load scripts once the state is created. 
state.loadExtData();


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

	state.lastCommandSent = Date.now();

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
				state.scriptPaused = false;
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
			sendResponse(state.userScripts);
			break;

		case "popup-save-configuration":
			saveConfiguration(request.message);
			break;

		case "popup-get-configuration":
			sendResponse(state.extConfig);
			break;

		// Return userScripts to the JSON editor
		case "editor-get-scripts":
			sendResponse(state.userScripts);
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
function sendClientMessage(msg, usePre = false) {
	// Add message to output
	const output = document.getElementById("output");
	const div = document.createElement("div");
	const text = document.createTextNode(`\r\n${msg}`);

	if (usePre) {
		const pre = document.createElement("pre");
		pre.appendChild(text);
		div.appendChild(pre);
	}
	else {
		div.appendChild(text);
	}

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

	if (state.scriptPaused === true) {
		return;
	}

	// Handle running the simple repeat command
	if (state.runRepeat) {
		if (data.includes("You are no longer busy.")) {
			setTimeout(function () {
				sendCommand(state.repeatCommand);
			}, getCommandDelayInMs());
			return;
		}
	}

	if (state.commandList.length > 0 && state.currentScriptType === "combat") {
		combatScript(data);
	} else if (state.commandList.length > 0 && state.currentScriptType === "noncom") {
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

		// If the parse has moveNextNow set to true, or if state.currentMoveNextWhen
		// is null, send the next command now:
		if (state.moveNextNow || !state.currentMoveNextWhen) {
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

	if (state.shouldKill) {
		// Override based on specific scenarios.
		if (
			data.includes("falls unconscious") ||
			(state.attemptingKill &&
				((data.includes("You hit") || data.includes("You miss")) || state.customKillCommand))
		) {
			state.attemptingKill = true;
			consoleLog(`state.customKillCommand: ${state.customKillCommand}, state.customKillCommandParse: ${state.customKillCommandParse}`);
			if (state.customKillCommand) {
				state.commandOverride = `${state.customKillCommand} ${state.target}`;
			}
			else {
				state.commandOverride = `kill ${state.target}`;
			}
		}

		// Handle being stuck trying to kill something.
		if (data.includes("must be unconscious first")) {
			state.commandOverride = "";
			state.attemptingKill = false;
			sendNextCommand();
		}

		// Handle resetting state.commandOverride after an `advance` attempt failure.
		if (state.extConfig.useMeleeAdvance && data.includes("You advance toward")) {
			if (state.advancingToKill) {
				if (state.customKillCommand) {
					state.commandOverride = `${state.customKillCommand} ${state.target}`;
				}
				else {
					state.commandOverride = `kill ${state.target}`;
				}
				state.advancingToKill = false;
			} else {
				state.commandOverride = "";
			}
		}

		// Detect weapon-specific kill echo and wipe the override for next no longer busy.
		if ((data.includes(state.shouldKillParse) && state.commandOverride.includes("kill")) || 
			(data.includes(state.customKillCommandParse) && state.commandOverride.includes(state.customKillCommand))
		) {
			state.attemptingKill = false;
			state.commandOverride = "";
		}
	}

	// Attempt to continue script after a critter/target walks in/arrives.
	if (state.continueOnWalkIn) {
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
		state.currentMoveNextWhen &&
		state.currentMoveNextWhen.length > 0 &&
		data.includes(state.currentMoveNextWhen)
	) {
		sendNextCommand();
	}
}

/**
 * Move the state.currentCmdIndex forward or reset to the first index.
 */
function moveCombatCmdIndex() {
	if (state.currentCmdIndex === state.commandList.length - 1) {
		if (state.addAttack) {
			state.commandOverride = `att ${state.target}`;
		}
		// Reset
		state.currentCmdIndex = 0;
	} else {
		// Move the command list index forward...
		state.currentCmdIndex++;
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
	// Handle addAttack state.commandOverride off-switch
	if (
		state.commandOverride.includes("att") &&
		(data.includes("You hit") || data.includes("You miss"))
	) {
		state.commandOverride = "";
	}

	// Handle sweeped/knocked down after failed attack attempt:
	if (
		data.includes("You must be standing") ||
		data.includes("You cannot do that right now") ||
		data.includes("You have disabled fighting while prone")
	) {
		let standCommand = state.extConfig.useBackwardsRiseToStand ? `brise` : `stand`;
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
		if (data.includes(state.weaponItemName)) {
			state.commandOverride = `get ${state.weaponItemName}`;
			state.recoveringWeapon = true;
		} else if (state.shieldItemName && data.includes(state.shieldItemName)) {
			state.commandOverride = `get ${state.shieldItemName}`;
			state.recoveringWeapon = true;
		}
	}
	// Handle fumble+fall (brawling/pank)
	if (data.includes("You fumble, falling")) {
		state.commandOverride = `stand`;
	}

	// Continuation of the fumble handling after picking up the weapon/shield...
	if (
		(data.includes("You take a") ||
			data.includes("You are already carrying")) &&	state.recoveringWeapon
	) {
		
		let cmds = [];
		if (data.includes(state.weaponItemName)) {
			cmds.push(`wield ${state.weaponItemName}`);
		} else if (state.shieldItemName && data.includes(state.shieldItemName)) {
			cmds.push(`wield ${state.shieldItemName}`);
		}
		// reset/remove `get {weapon/shield}`
		state.commandOverride = "";
		cmds.push(getFormattedCommand());
		sendDelayedCommands(cmds);

		state.recoveringWeapon = false;
	}
	// These not-wielding scenarios don't require waiting for no longer busy.
	if (data.includes("You can't do that right now")) {
		let cmds = [`get ${state.weaponItemName}`, `wield ${state.weaponItemName}`];
		if (state.shieldItemName) {
			cmds.push(`get ${state.shieldItemName}`);
			cmds.push(`wield ${state.shieldItemName}`);
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
		let cmds = [`get ${state.weaponItemName}`, `wield ${state.weaponItemName}`];
		if (state.shieldItemName) {
			cmds.push(`get ${state.shieldItemName}`);
			cmds.push(`wield ${state.shieldItemName}`);
		}
		cmds.push(getFormattedCommand());
		sendDelayedCommands(cmds);
	}
	if (data.includes("You must be wielding your weapon in two hands")) {
		sendDelayedCommands([`wield ${state.weaponItemName}`, getFormattedCommand()]);
	}

	if (data.includes("You must be wielding a shield to")) {
		sendDelayedCommands([
			`get ${state.shieldItemName}`,
			`wield ${state.shieldItemName}`,
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
		if (state.entangledCommand) {
			if (entangledCommand.includes("<weapon>")) {
				state.entangledCommand = state.entangledCommand.replaceAll(
					"<weapon>",
					state.weaponItemName
				);
			}
			// Not using sendDelayedCommands here as it wipes out `state.commandOverride`,
			// and can interfere with `kill` attempts.
			setTimeout(function () {
				sendCommand(state.entangledCommand);
			}, getCommandDelayInMs());
		} else {
			sendDelayedCommands([`free`, getFormattedCommand()]);
		}
	}

	// Handle distance/approaching
	if (data.includes("is not close enough")) {
		let engageCommand = `engage`;

		if (state.extConfig.useMeleeAdvance) {
			engageCommand = `advance`;
		}
		// If both useMeleeAdvance and useCustomApproach are enabled, use
		// custom approach.
		if (state.extConfig.useCustomApproach) {
			engageCommand = state.extConfig.customApproachCommand;
		}

		if (state.extConfig.useMeleeAdvance && state.commandOverride.includes("kill")) {
			// In combatScript, this is used to reset state.commandOverride to `kill` when
			// Melee Advance/Custom Approach is done successfully.
			state.advancingToKill = true;
		}
		// Not using sendDelayedCommands here as it wipes out `state.commandOverride`,
		// and can interfere with `kill` attempts.
		setTimeout(function () {
			sendCommand(`${engageCommand} ${state.target}`);

			if (engageCommand.includes("engage")) {
				setTimeout(function () {
					// Next attack as 'You attempt to engage <target>' doesn't have a round time.
					sendCommand(
						state.commandOverride ? state.commandOverride : getFormattedCommand()
					);
				}, getCommandDelayInMs(400));
			}
		}, getCommandDelayInMs());
	}
	// Handle failing to Melee Advance if it's toggled on
	if (state.extConfig.useMeleeAdvance && data.includes("but can't get close")) {
		if (state.commandOverride.includes("kill")) {
			// In combatScript, this is used to reset state.commandOverride to `kill` when
			// Melee Advance is done successfully.
			state.advancingToKill = true;
		}
		// Next No Longer Busy will advance the target
		state.commandOverride = `advance ${state.target}`;
	}
	// Handle being stuck trying to engage an already approached target, having
	// being too close to approach, or are already standing.
	if (
		data.includes("You are already engaging") ||
		data.includes("is too close.") ||
		data.includes("You are already standing")
	) {
		state.commandOverride = "";
		sendNextCommand(850);
	}

	// Handle the scenario where you're trying to attack/kill something that has
	// been pushed back/retreated.
	if (data.includes("You'll have to retreat first")) {
		// If melee advance is toggled on in config, use it.
		if (state.extConfig.useMeleeAdvance) {
			// Not using sendDelayedCommands here as it wipes out `state.commandOverride`,
			// and can interfere with `kill` attempts.
			setTimeout(function () {
				sendCommand(`advance ${state.target}`);
			}, getCommandDelayInMs());
		} else {
			// Best attempt to try to continue and see if the distance resolves itself.
			sendNextCommand();
		}
	}

	// Handle stance when not auto:
	if (data.includes("You are not in the correct stance")) {
		if (state.stance) {
			sendDelayedCommands([state.stance]);
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
		if (state.currentCmdIndex === state.commandList.length - 1) {
			// Reset
			state.currentCmdIndex = 0;
		} else {
			// Move the command list index forward...
			state.currentCmdIndex++;
		}

		// If the parse has moveNextNow set to true, or if  state.currentMoveNextWhen is null, send the next command now:
		if (state.moveNextNow || !state.currentMoveNextWhen) {
			// Delay to avoid commands being sent too close together.
			sendNextCommand(400);
			return;
		}
	}

	// Main work for nonCom loop:
	if (
		state.currentMoveNextWhen &&
		state.currentMoveNextWhen.length > 0 &&
		data.includes(state.currentMoveNextWhen)
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
	const script = state.userScripts.find((s) => {
		return s.scriptName.toLowerCase() === scriptName.toLowerCase();
	});

	if (!script) {
		consoleLog(`no script found matching name: ${scriptName}`);
	} else {
		killCurrentScript();
		sendClientMessage(
			`Starting script: ${scriptName} (${script.scriptFriendlyName})`
		);

		state.currentMoveNextWhen = "You are no longer busy";

		state.target = options.target || "";
		state.weaponItemName = options.weaponItemName || "";
		state.shieldItemName = options.shieldItemName || "";
		state.shouldKill =
			options.shouldKill !== null ? options.shouldKill : script.shouldKill;
		state.shouldKillParse = script.shouldKillParse;
		state.customKillCommand = script.customKillCommand;
		state.customKillCommandParse = script.customKillCommandParse;

		consoleLog(`customKillCommand: ${state.customKillCommand}, customKillCommandParse: ${state.customKillCommandParse}`);

		state.continueOnWalkIn =
			options.continueOnWalkIn !== null
				? options.continueOnWalkIn
				: script.continueOnWalkIn;
		state.addAttack = script.addAttack;
		state.stance = script.stanceCommand;
		state.entangledCommand = script.entangledCommand;
		state.currentScriptType = script.scriptType.toLowerCase();
		state.currentScriptName = script.scriptName;
		state.currentScript = script;
		state.scriptPaused = false;

		script.commandList.forEach(function (command, index) {
			state.commandList.push(command);
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
	if (!state.scriptPaused) {
		killCurrentScript();
	}
	// This variable is used in the parseMessage function to repeat the command.
	state.runRepeat = true;
	state.repeatCommand = command;
	state.lastCommandRan = command;

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
	state.runRepeatWithDelay = true;
	state.repeatWithDelayCommand = command;
	state.lastCommandRan = command;

	var intr = setInterval(function () {
		if (!state.runRepeatWithDelay) {
			clearInterval(intr);
		}
		if (!state.scriptPaused && state.runRepeatWithDelay) {
			sendCommand(command);
		}
	}, 1000);
}

/**
 * Kill it with fire (reset all state for the currently configured script)
 */
function killCurrentScript() {
	if (state.currentScriptName || state.lastCommandRan) {
		sendClientMessage(`Stopping script: ${getRunningCommand()}`);
	}

	state.resetState();
}

/**
 * Pause the current script
 */
function pauseCurrentScript() {
	state.scriptPaused = true;
	sendClientMessage(`Paused: ${getRunningCommand()}`);
}

/**
 * Resume the current script
 */
function resumeCurrentScript() {
	// Start the repeat again if it's the active script.
	if (state.runRepeat) {
		runSimpleRepeat(state.repeatCommand);
		state.scriptPaused = false;
	} else {
		state.scriptPaused = false;
		// Regular script, send the command.
		sendNextCommand();
	}

	sendClientMessage(`Resumed: ${getRunningCommand()}`);
}

/**
 * Send the next command on the state.commandList
 * @param {number} additionalDelay
 */
function sendNextCommand(additionalDelay) {
	if (!shouldSendNextCommand()) {
		consoleLog(`shouldSendNextCommand was false, don't send command.`);
		return;
	}

	let commandDelayInMs = getCommandDelayInMs(additionalDelay);
	// Handle delaying this command given the previous command's delayBeforeNext value, if present.
	if (state.delayNextCommandBy > 0) {
		commandDelayInMs = state.delayNextCommandBy;
		// Reset the delay
		state.delayNextCommandBy = 0;
	}

	setTimeout(function () {
		// Set override or use current command value:
		sendCommand(getFormattedCommand());

		// Reset to a default here now to prevent it from sending back to back commands
		state.currentMoveNextWhen = "You are no longer busy";
		state.moveNextNow = false;

		// This numeric value, if it's configured for the current command in the state.commandList,
		// is intended to delay the script from moving onto the next command for a given
		// number of milliseconds.
		state.delayNextCommandBy = state.commandList[state.currentCmdIndex]?.delayBeforeNext ?? 0;
	}, commandDelayInMs);
}

/**
 * Determine whether or not we should send the next command. Special rules apply
 */
function shouldSendNextCommand() {
	var sendCommand = true;

	// Only rule, for now.
	if (state.runRepeatWithDelay) {
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
		state.commandOverride = "";
	}
}

/**
 * Replace expected special sequences in a command string with the appropriate
 * values from script variables. This will likely become more robust over time.
 */
function getFormattedCommand() {
	if (state.commandList.length <= 0 || state.commandList[state.currentCmdIndex] === undefined) {
		return "";
	}

	let command = "";

	// If we have a temporary command override, apply it.
	if (state.commandOverride) {
		command = state.commandOverride;
	} else {
		command = state.commandList[state.currentCmdIndex].command;
		let targetRequired = true;

		// If there is a value present for targetRequired, and it is false, then don't add a target.
		if (
			state.commandList[state.currentCmdIndex].targetRequired !== undefined &&
			!state.commandList[state.currentCmdIndex].targetRequired
		) {
			targetRequired = false;
		}

		// Check if the command has moved <target> to be replaced:
		if (command.includes("<target>")) {
			// Check for target replacement:
			command = command.replaceAll("<target>", state.target);
		} else if (targetRequired) {
			// Tack target onto the end by default:
			if (state.target) {
				command += ` ${state.target}`;
			}
		}
	}

	return command;
}

/**
 * Check data from the server to determine if it satisfies the parse requirements
 * for the current command in commandList. If matched it will set the value of
 * state.currentMoveNextWhen (identifies the trigger to run the next command).
 * @param {string} data
 */
function matchExpectedParse(data) {
	if (state.commandList.length < 1) {
		consoleLog("commandList is empty... stop running?");
		return false;
	}

	let matchFound = false;
	const parse = state.commandList[state.currentCmdIndex].parse;

	// If the expected parse check is an array, check each:
	if (Array.isArray(parse)) {
		for (var i = 0; i < parse.length; i++) {
			if (matchOutcome(data, parse[i].outcome)) {
				matchFound = true;
				if (parse[i].moveNextNow) {
					state.moveNextNow = true;
				}
				// Set value to detect for moving onto the next command:
				state.currentMoveNextWhen = parse[i].moveNextWhen;
				break;
			}
		}
	} else {
		if (matchOutcome(data, parse.outcome)) {
			matchFound = true;
			if (parse.moveNextNow) {
				state.moveNextNow = true;
			}
			// Set value to detect for moving onto the next command:
			state.currentMoveNextWhen = parse.moveNextWhen;
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
			item = item.replaceAll("<target>", state.target);
		}
		return item.trim();
	});

	return outcomeSplit.some((outcome) => data.includes(outcome));
}

/*********************************************************************************************/
/** Local Utility **/

/**
 * Get a somewhat random delay in miliseconds
 * @param {number} additionalDelay This amount will be added onto the random delay
 * @returns
 */
function getCommandDelayInMs(additionalDelay) {
	let min = isPositiveNumeric(state.extConfig.commandDelayMin)
		? Number(state.extConfig.commandDelayMin)
		: state.defaultCommandDelayMin;
	let max = isPositiveNumeric(state.extConfig.commandDelayMax)
		? Number(state.extConfig.commandDelayMax)
		: state.defaultCommandDelayMax;
	let diff = max - min;

	// Fallback for an incorrectly defined range in config
	if (diff <= 0) {
		min = state.defaultCommandDelayMin;
		max = state.defaultCommandDelayMax;
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
 * Constantly running function to check if it's been more than a
 * defined number of milliseconds since the last command was sent
 * while a script is running. If it has, send the next command to
 * kick things off again.
 */
(function(){
 	let maxCmdDelay = isPositiveNumeric(state.extConfig?.commandDelayMax)
		? Number(state.extConfig.commandDelayMax)
		: state.defaultCommandDelayMax;

	// Min value to avoid sending too fast back to back.
	maxCmdDelay = maxCmdDelay < 1000
			? 1000
			: maxCmdDelay;

	if (state.commandList.length > 0 && !state.scriptPaused) 	{
		let retryMs = state.defaultCommandDelayMax;

		// Grab the commandRetryMs from the current command. If it's 0 the current command has disabled
		// retries while it's waiting for a parse - so we carry that 0 below and it skips the retry.
		// Otherwise, it's a command-level custom retry definition and we'll honor it while that command
		// is running (script writer knows to move to the next command after a custom amount of time).
		let commandRetryOverride = -1; 
		if (state.commandList[state.currentCmdIndex]?.commandRetryMs !== undefined) {
			commandRetryOverride = isPositiveNumeric(state.commandList[state.currentCmdIndex].commandRetryMs)
				? Number(state.commandList[state.currentCmdIndex].commandRetryMs)
				: commandRetryOverride; 
		}

		// Use command-level retry override
		if (commandRetryOverride > -1) {
			retryMs = commandRetryOverride;
		} 
		// Use globally defined command retry
		else {
			retryMs = isPositiveNumeric(commstate.extConfig?.commandRetryMs)
				? Number(state.extConfig.commandRetryMs)
				: state.defaultCommandRetryMs;
		}

		const timeDiff = Date.now() - state.lastCommandSent;
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
			const message = dedentPreserveLayout(`
				Command Notes
				  - Square brackets ([]) denote a command argument
				  - Asterisk square brackets (*[]) denote a boolean argument that's optional (default is true) 
				  - Commands with arguments should be separated by spaces all within a single line, ie:
				    /start spearClose thug|brute boison-tipped
				    /start archShot thug|brute bow none true true
				    /start clubShieldBrawl thug|brute mace triangle false true
				
				Script Commands
				  /scripts : List of currently defined scripts
				  /editscripts : Open the edit scripts window
				  /current : Display the currently running script
				  /start : Start a script by name
				    [scriptName]
				    [target]
				    [weaponItemName]
				    [shieldItemName]	
				    *[shouldKill]
				    *[continueOnWalkIn]
				  /stop : Stop the currently running script
				  /repeat	: Repeat a command with a delay
				    [command]
				  /repeatnlb : Repeat a command after 'No longer busy'
				    [command]
				  /pause : Pause the current script
				  /resume : Resume the current script
				
				Utility Commands
				  /authhash : Get the TEC auth hash for the current user
			`)
			sendClientMessage(message, true);
			break;
		case "/scripts":
			const scripts = state.userScripts
				.map((s) => s.scriptName)
				.toString()
				.replace(/,/g, "\r\n");

			sendClientMessage(dedent(`
				Here are the names of available scripts:
					${scripts}
			`));
			break;
		case "/editscripts":
			openEditScripts();
			break;
		case "/current":
			sendClientMessage(`The current script is: ${state.currentScriptName}`);
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
			const scriptTarget = commandParams[2];
			const scriptWeaponItemName = commandParams[3];
			const scriptShieldItemName = commandParams[4];
			let scriptShouldKill = null;
			let scriptContinueOnWalkIn = null;

			if (commandParams.length >= 6) {
				scriptShouldKill = stringToBoolean(commandParams[5]);
			}
			if (commandParams.length >= 7) {
				scriptContinueOnWalkIn = stringToBoolean(commandParams[6]);
			}

			const script = state.userScripts.find((s) => {
				return s.scriptName.toLowerCase() === scriptName.toLowerCase();
			});

			if (!script) {
				sendClientMessage(`Script not found.`);
			}

			runScriptByName(scriptName, {
				target: scriptTarget,
				weaponItemName: scriptWeaponItemName,
				shieldItemName: scriptShieldItemName,
				shouldKill: scriptShouldKill,
				continueOnWalkIn: scriptContinueOnWalkIn,
			});
			state.lastCommandRan = command;
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
			state.scriptPaused = false;
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
			state.scriptPaused = false;
			runSimpleRepeat(repeatNlbCmd);
			sendClientMessage(`Starting to repeat the command: ${repeatNlbCmd}`);
			break;
		case "/pause":
			pauseCurrentScript();
			break;
		case "/resume":
			resumeCurrentScript();
			break;
		case "/authhash":
			sendClientMessage(`Auth hash: ${getAuthHash()}`);
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

	if (state.currentScriptName) {
		runningCmd = `Script - ${state.currentScriptName}`;
	} else {
		runningCmd = state.lastCommandRan;
	}

	return runningCmd;
}
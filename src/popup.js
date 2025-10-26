/*********************************************************************************************/
/* Extension popup logic: event wireup and UI logic. */

const popupTabUrl = "*://client.eternalcitygame.com/*";
const config = {};

// Wait to grab Ids for adding event listeners
document.addEventListener("DOMContentLoaded", function () {
	// Plain message input:
	document
		.getElementById("sendCommand")
		.addEventListener("click", function (e) {
			const command = document.getElementById("commandInput").value;
			if (command) {
				chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
					chrome.tabs.sendMessage(tabs[0].id, {
						type: "popup-send-command",
						message: command,
					});
				});
			}
		});
	document
		.getElementById("commandInput")
		.addEventListener("keydown", function (e) {
			console.log(`e.key: ${e.key}`);
			if (e.key == "Enter" && this.value) {
				let msg = this.value;
				chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
					chrome.tabs.sendMessage(tabs[0].id, {
						type: "popup-send-command",
						message: msg,
					});
				});
				this.value = "";
			}
		});

	document.getElementById("saveConfig").addEventListener("click", function (e) {
		// Script params
		config.selectedScript = document.getElementById("scriptSelect").value;
		config.weaponItemName = document.getElementById("weaponItemName").value;
		config.shieldItemName = document.getElementById("shieldItemName").value;
		config.targetInput = document.getElementById("targetInput").value;
		// Comms config
		config.enableComms = document.getElementById("enableComms").checked;
		config.includeThoughts = document.getElementById("includeThoughts").checked;
		config.includeOOC = document.getElementById("includeOOC").checked;
		config.includeSpeech = document.getElementById("includeSpeech").checked;
		config.removeThoughtsFromMain = document.getElementById(
			"removeThoughtsFromMain"
		).checked;
		config.removeOOCFromMain =
			document.getElementById("removeOOCFromMain").checked;
		config.removeSpeechFromMain = document.getElementById(
			"removeSpeechFromMain"
		).checked;
		config.commsBoxHeight = document.getElementById("commsBoxHeight").value;
		config.commsMuteList = document.getElementById("commsMuteList").value;
		config.commsMuteListArray = config.commsMuteList
			.split(",")
			.map((item) => item.trim());
		// Combat config
		config.shouldKill = document.getElementById("shouldKill").checked;
		config.continueOnWalkIn =
			document.getElementById("continueOnWalkIn").checked;
		config.useBackwardsRiseToStand = document.getElementById(
			"useBackwardsRiseToStand"
		).checked;
		config.useMeleeAdvance = document.getElementById("useMeleeAdvance").checked;
		config.useCustomApproach = document.getElementById("useCustomApproach").checked;
		config.customApproachCommand = document.getElementById("customApproachCommand").value;
		// General Config
		config.commandDelayMin = document.getElementById("commandDelayMin").value;
		config.commandDelayMax = document.getElementById("commandDelayMax").value;
		config.commandRetryMs = document.getElementById("commandRetryMs").value;
		config.scriptCounterStopAt = document.getElementById("scriptCounterStopAt").value;
		config.darkModeEnabled = document.getElementById("darkModeEnabled").checked;

		saveConfiguration(config);

		updatePopupLayout();
	});

	// Simple command repeat, checks for no longer busy
	document.getElementById("sendRepeat").addEventListener("click", function (e) {
		const repeatCommand = document.getElementById("repeatInput").value;
		if (repeatCommand) {
			chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, {
					type: "popup-send-repeat",
					message: repeatCommand,
				});
			});
		}
	});

	// Run the selected script by name, with options
	document.getElementById("runScript").addEventListener("click", function (e) {
		const scriptName = document.getElementById("scriptSelect").value;
		const target = document.getElementById("targetInput").value;
		const weaponItemName = document.getElementById("weaponItemName").value;
		const shieldItemName = document.getElementById("shieldItemName").value;
		const shouldKill = document.getElementById("shouldKill").checked;
		const continueOnWalkIn =
			document.getElementById("continueOnWalkIn").checked;

		// Save current script param inputs in config for re-use:
		config.selectedScript = scriptName;
		config.weaponItemName = weaponItemName;
		config.shieldItemName = shieldItemName;
		config.targetInput = target;
		saveConfiguration(config);

		// This will become data driven later, via json/local storage with defaults
		// TODO: Move options into its own JSON config, load it like scripts are loaded
		chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, {
				type: "popup-run-script",
				message: {
					scriptName: scriptName,
					target: target,
					weaponItemName: weaponItemName,
					shieldItemName: shieldItemName,
					shouldKill: shouldKill,
					continueOnWalkIn: continueOnWalkIn,
				},
			});
		});
	});

	document.getElementById("stopScript").addEventListener("click", function (e) {
		// Kill the current script
		chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { type: "popup-kill-script" });
		});
	});

	document
		.getElementById("pauseScript")
		.addEventListener("click", function (e) {
			// Pause the current script.
			chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, { type: "popup-pause-script" });
			});
		});

	document
		.getElementById("resumeScript")
		.addEventListener("click", function (e) {
			// Resume the current script.
			chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, { type: "popup-resume-script" });
			});
		});

	// Edit script modal
	document
		.getElementById("editScripts")
		.addEventListener("click", function (e) {
			chrome.windows.create(
				{
					url: "edit-scripts.html",
					type: "popup",
					height: 1000,
					width: 900,
				},
				function (window) {}
			);
		});

	// Listener to handle requests from the background script:
	chrome.runtime.onMessage.addListener(function (
		request,
		sender,
		sendResponse
	) {
		if (request.msg === "reload-scripts-select") {
			loadScriptSelect();
		}
		if (request.msg === "config-saved-success") {
			setConfigMessage("Configuration updated!");
		}
	});

	// Initial scripts load:
	loadScriptSelect();

	// Initial config load:
	getConfiguration();

	// Update visual elements of popup based on config:
	updatePopupLayout();
});

// Set the configMessage div with a given message, which will fade after 5 seconds.
function setConfigMessage(msg) {
	if (msg) {
		const configMessage = document.getElementById("configMessage");

		configMessage.innerHTML = msg;
		configMessage.className = "hide-5";

		setTimeout(function () {
			configMessage.innerHTML = "";
			configMessage.className = "";
		}, 5000);
	}
}

/**
 *  Load combat script choices from background page:
 */
function loadScriptSelect() {
	const select = document.getElementById("scriptSelect");
	// Clear select
	select.innerText = null;

	// Load scripts:
	chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
		chrome.tabs.sendMessage(
			tabs[0].id,
			{ type: "popup-get-scripts" },
			function (response) {
				// Response will be an array of script objects
				if (response) {
					response.forEach((element) => {
						const opt = document.createElement("option");
						opt.value = element.scriptName;
						opt.innerHTML = element.scriptFriendlyName;
						select.appendChild(opt);
					});
				}
			}
		);
	});
}

function getConfiguration() {
	chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
		chrome.tabs.sendMessage(
			tabs[0].id,
			{ type: "popup-get-configuration" },
			function (response) {
				// Response will be a config object
				if (response) {
					// Hydrate local config for usage throughout the life of the popup window
					// Script params
					config.selectedScript = response.selectedScript;
					config.weaponItemName = response.weaponItemName;
					config.shieldItemName = response.shieldItemName;
					config.targetInput = response.targetInput;
					// Comms config
					config.enableComms = response.enableComms;
					config.includeThoughts = response.includeThoughts;
					config.includeOOC = response.includeOOC;
					config.includeSpeech = response.includeSpeech;
					config.removeThoughtsFromMain = response.removeThoughtsFromMain;
					config.removeOOCFromMain = response.removeOOCFromMain;
					config.removeSpeechFromMain = response.removeSpeechFromMain;
					config.commsBoxHeight = response.commsBoxHeight;
					config.commsMuteList = response.commsMuteList;
					// Combat config
					config.shouldKill = response.shouldKill;
					config.continueOnWalkIn = response.continueOnWalkIn;
					config.useBackwardsRiseToStand = response.useBackwardsRiseToStand;
					config.useMeleeAdvance = response.useMeleeAdvance;
					config.useCustomApproach = response.useCustomApproach;
					config.customApproachCommand = response.customApproachCommand;
					// General Config
					config.commandDelayMin = response.commandDelayMin;
					config.commandDelayMax = response.commandDelayMax;
					config.commandRetryMs = response.commandRetryMs;
					config.scriptCounterStopAt = response.scriptCounterStopAt;
					config.darkModeEnabled = response.darkModeEnabled;

					// Apply configurations to inputs
					let scriptSelect = document.getElementById("scriptSelect");
					scriptSelect.value = config.selectedScript || scriptSelect.options[0].value;
					document.getElementById("weaponItemName").value = config.weaponItemName ?? "";
					document.getElementById("shieldItemName").value = config.shieldItemName ?? "";
					document.getElementById("targetInput").value = config.targetInput ?? "";
					document.getElementById("enableComms").checked = config.enableComms;
					document.getElementById("includeThoughts").checked =
						config.includeThoughts;
					document.getElementById("includeOOC").checked = config.includeOOC;
					document.getElementById("includeSpeech").checked =
						config.includeSpeech;
					document.getElementById("removeThoughtsFromMain").checked =
						config.removeThoughtsFromMain;
					document.getElementById("removeOOCFromMain").checked =
						config.removeOOCFromMain;
					document.getElementById("removeSpeechFromMain").checked =
						config.removeSpeechFromMain;
					document.getElementById("commsBoxHeight").value =
						config.commsBoxHeight;
					document.getElementById("commsMuteList").value =
						config.commsMuteList ?? null;
					document.getElementById("shouldKill").checked = config.shouldKill;
					document.getElementById("continueOnWalkIn").checked =
						config.continueOnWalkIn;
					document.getElementById("useBackwardsRiseToStand").checked =
						config.useBackwardsRiseToStand;
					document.getElementById("useMeleeAdvance").checked =
						config.useMeleeAdvance;
					document.getElementById("useCustomApproach").checked = 
						config.useCustomApproach;
					document.getElementById("customApproachCommand").value = 
						config.customApproachCommand;
					document.getElementById("commandDelayMin").value =
						config.commandDelayMin ?? 900;
					document.getElementById("commandDelayMax").value =
						config.commandDelayMax ?? 1100;
					document.getElementById("commandRetryMs").value = 
						config.commandRetryMs ?? 60000;
					document.getElementById("scriptCounterStopAt").value = 
						config.scriptCounterStopAt ?? 0;
					document.getElementById("darkModeEnabled").checked =
						config.darkModeEnabled ?? false;

					updatePopupLayout();
				}
			}
		);
	});
}

/**
 * Save Configuration
 */
function saveConfiguration(config) {
	chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
		chrome.tabs.sendMessage(tabs[0].id, {
			type: "popup-save-configuration",
			message: config,
		});
	});
}

// I don't remember why this function is here, but I also don't want to delete it.
function resizeMe() {
	height = document.getElementsByClassName("popup-container")[0].offsetHeight;
	width = document.getElementsByClassName("popup-container")[0].offsetWidth;
	self.resizeTo(width, height + 50);
}

// Update visual elements of the popup via configuration
function updatePopupLayout() {
	const body = document.getElementsByTagName("body")[0];

	if (config.darkModeEnabled) {
		if (!body.classList.contains("dark-mode")) {
			body.classList.add("dark-mode");
		}
	} else {
		if (body.classList.contains("dark-mode")) {
			body.classList.remove("dark-mode");
		}
	}
}

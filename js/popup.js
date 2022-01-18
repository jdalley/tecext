
/*********************************************************************************************/
/* Extension popup logic: event wireup and UI logic. */

const popupTabUrl = "*://client.eternalcitygame.com/*";

// Wait to grab Ids for adding event listeners
document.addEventListener("DOMContentLoaded", function () {
	// Plain message input:
	document.getElementById("sendCommand").addEventListener("click", function (e) {
		const command = document.getElementById("commandInput").value;
		if (command) {
			chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, { 
						type: "popup-send-command",
						message: command
					})
			});
		}
	});
	document.getElementById("commandInput").addEventListener("keydown", function (e) {
		console.log(`e.key: ${e.key}`);
		if (e.key == "Enter" && this.value) {
			let msg = this.value;
			chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, { 
						type: "popup-send-command",
						message: msg
					})
			});
			this.value = "";
		}
	});

	// Simple command repeat, checks for no longer busy
	document.getElementById("sendRepeat").addEventListener("click", function (e) {
		const repeatCommand = document.getElementById("repeatInput").value;
		if (repeatCommand) {
			chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, { 
						type: "popup-send-repeat",
						message: repeatCommand
					})
			});
		}
	});

	// Run the selected script by name, with options
	document.getElementById("runScript").addEventListener("click", function (e) {
		const scriptName = document.getElementById("scriptSelect").value;
		const target = document.getElementById("targetInput").value;
		const weaponItemName = document.getElementById("weaponItemName").value;
		const shouldKill = document.getElementById("shouldKill").checked;
		const continueOnWalkIn = document.getElementById("continueOnWalkIn").checked;

		// This will become data driven later, via json/local storage with defaults
		// TODO: Move options into its own JSON config, load it like scripts are loaded
		chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { 
				type: "popup-run-script",
				message: {
					scriptName: scriptName,
					target: target,
					weaponItemName: weaponItemName,
					shouldKill: shouldKill,
					continueOnWalkIn: continueOnWalkIn,
				}
				})
		});
	});

	document.getElementById("stopScript").addEventListener("click", function (e) {
		// Kill the current script
		chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { type: "popup-kill-script" })
		});
	});

	document.getElementById("pauseScript").addEventListener("click", function (e) {
		// Pause the current script.
		chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { type: "popup-pause-script" })
		});
	});

	document.getElementById("resumeScript").addEventListener("click", function (e) {
		// Resume the current script.
		chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { type: "popup-resume-script" })
		});
	});

	// Edit script modal
	document.getElementById("editScripts")
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

	// Listener to update the script select; expected to trigger from Edit Scripts window:
	chrome.runtime.onMessage.addListener(function (
		request,
		sender,
		sendResponse
	) {
		if (request.msg === "reload-scripts-select") {
			loadScriptSelect();
		}
	});

	// Initial scripts load:
	loadScriptSelect();
});

/**
 *  Load combat script choices from background page:
 */
function loadScriptSelect() {
	const select = document.getElementById("scriptSelect");
	// Clear select
	select.innerText = null;

	// Load scripts:
	chrome.tabs.query({ url: popupTabUrl }, function (tabs) {
		chrome.tabs.sendMessage(tabs[0].id, {	type: "popup-get-scripts"	},
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
			});
	});
}

// I don't remember why this function is here, but I also don't want to delete it.
function resizeMe() {
	height = document.getElementsByClassName("popup-container")[0].offsetHeight;
	width = document.getElementsByClassName("popup-container")[0].offsetWidth;
	self.resizeTo(width, height + 50);
}
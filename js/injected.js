/**
 * This is injected into the page to have access to existing javascript variables, events, data
 * from web sockets, and functions. It will send messages back and forth to the content script
 * that injected it; which will pipe back to the background script for the extension.
 */

// Send intercepted data to the content script:
function doReceiveOverride(msg) {
	document.dispatchEvent(
		new CustomEvent("tecReceiveMessage", {
			detail: {
				timestamp: new Date().toISOString(),
				data: msg,
			},
		})
	);
}

// Send intercepted commands to the content script:
function doSendOverride(msg) {
	document.dispatchEvent(
		new CustomEvent("tecSendCommand", {
			detail: {
				timestamp: new Date().toISOString(),
				command: msg,
			},
		})
	);
}

// Take communication messages and add them to the comms element.
function pullCommunication(msg) {
	let shouldOutput = false;

	console.log(msg);

	/*
		Notes on parsing:
		Thoughts:
			- 'thinks aloud' may need to be captured from '<' to '>' to avoid taking on more text.
		OOC: 
			- 'OOC>' should be enough, but like thoughts we might need to capture from '<' to '>' like Thoughts.
		Speech:
			- The presence of '"' and not !'OOC>' (as OOC also uses double quotes) might be enough to grab speech text.
	*/
	
	if (msg.indexOf('say to') >= 0
	    || msg.indexOf(' says') >= 0
	    || msg.indexOf(' ask') >= 0
	    || msg.indexOf(' exclaim') >= 0
	    || msg.indexOf(' wink') >= 0) {
	    msg = `<div style="color: #00cde1;">${msg}</div>`;
			shouldOutput = true;
	}

	if (msg.indexOf('thinks aloud') >= 0) {
		msg = `<div style="color: #ff69b4;">${msg}</div>`;
		shouldOutput = true;
	}

	if (msg.indexOf('OOC>')  >= 0) {
		msg = `<div style="color: #65cd00;">${msg}</div>`;
		shouldOutput = true;
	}

	if (shouldOutput) {
		outputComms(msg);
	}
}

// Write communication-oriented messages to the comms window:
function outputComms(msg) {
	let comms = document.getElementById('comms');
	if (comms) {
		comms.insertAdjacentHTML(
			"beforeend",
			`
				${msg}
			`
		);

		// scroll to bottom
		comms.scrollTop = comms.scrollHeight;
	}
}

/**
 * Create the Comms element with a given configuration.
 */
function createCommsElement(config) {
	if (!config) {
		console.log("createCommsElement called with null/empty config.");
		return false;
	}

	setTimeout(function () {
		const outputArea = document.getElementById("output");
		if (outputArea) {
			let display = config.enableComms ? "inherit" : "none";

			// Insert UI elements above the macro area.
			document.getElementById("output").insertAdjacentHTML(
				"afterBegin",
				`
					<style>
						#comms {
							display: ${display};
							position: sticky;
							top: 0;
							height: 150px;
							border:3px gray inset;
							border-bottom-width: 5px;
							overflow:auto; 
							padding: 0 0.5em; 
							overflow-wrap:break-word;
							white-space: normal;
							background-color: inherit;
						}
					</style>
				
					<div id="comms" class="selectable"></div>
				`
			);
		}
	}, 1000);
}

// Update the Comms element with a given configuration.
function updateCommsElement(config) {
	if (!config) {
		return false;
	}
	
	const comms = document.getElementById('comms');
	comms.style.display = config.enableComms ? "inherit" : "none";
}

/*********************************************************************************************/
/** Apply overrides, add event listeners, run initial setup via timeouts. **/

// Override the doReceive function on the page to intercept data, then send it on.
if (typeof doReceive !== "undefined") {
	const origDoReceive = doReceive;
	doReceive = function (msg) {
		doReceiveOverride(msg);

		// Pull out communication for the comms window:
		pullCommunication(msg);

		origDoReceive.apply(this, arguments);
		return;
	};
}

// Override the doSend function on the page to intercept commands entered.
if (typeof doSend !== "undefined") {
	const origDoSend = doSend;
	doSend = function (msg, noecho) {
		doSendOverride(msg);
		// Don't apply the original function if a slash command is detected.
		if (msg.indexOf("/") !== 0) {
			origDoSend.apply(this, arguments);
		}
		return;
	};
}

// Receive commands from the content script, and send them to the existing doSend
// function on the page. This function pipes the command back to the web socket.
document.addEventListener("tecSendMessage", function (e) {
	const msg = e.detail.data;
	if (msg) {
		// Ref: orchil.js - doSend(message, noecho)
		doSend(msg, true);
	}
});

// Receive configuration updates from the content script, and apply them.
document.addEventListener("extensionApplyConfig", function (e) {
	const config = e.detail.data;
	if (config) {
		const comms = document.getElementById('comms');
		if (!comms){
			createCommsElement(config);
		}
		else if (comms) {
			updateCommsElement(config);
		}
	}
});

// Add static elements without configuration to the page
setTimeout(function () {
	const macroArea = document.getElementById("macro_area");

	if (macroArea) {
		// Insert UI elements above the macro area.
		document.getElementById("macro_area").insertAdjacentHTML(
			"beforebegin",
			`
						<style>
								@keyframes fadeIn {
										from {
												opacity:0;
										}
										to {
												opacity:1;
										}
								}
						</style>
						<div id="tecext" style="
								margin-bottom: 3px;
								padding: 6px;
								animation: fadeIn 0.75s;">
								<div id="editScripts" style="
										cursor: pointer;
										background-color:#5eba7d;">Edit Scripts</div>
						</div>
				`
		);
	}

	const editScripts = document.getElementById("editScripts");
	if (editScripts) {
		// Send an event to the content script to open the edit scripts window.
		document
			.getElementById("editScripts")
			.addEventListener("click", function () {
				document.dispatchEvent(
					new CustomEvent("tecUICommand", {
						detail: {
							timestamp: new Date().toISOString(),
							command: "openEditScripts",
						},
					})
				);
			});
	}
}, 1000);

// Remove the focusFix event from mouseup so click events can fire.
setTimeout(function () {
	window.removeEventListener("mouseup", fixFocus);
}, 2500);

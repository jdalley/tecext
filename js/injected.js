/**
 * This is injected into the page to have access to existing javascript variables, events, data
 * from web sockets, and functions. It will send messages back and forth to the content script
 * that injected it; which will pipe back to the background script for the extension.
 */

// Contains config received from local storage.
let injectedConfig = {};

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
	// Whether to send this message to Orchil's doReceive method.
	let sendToOutput = true;
	let shouldSendToComms = false;
	let outputMessage = '';
	let timestamp = new Date().toLocaleTimeString();

	// TODO: Remove me, I'm a 'debugger'
	console.log(`-----block-begin-----`);
	console.log(msg);
	console.log(`-----block-end-----`);

	// Example: <Someone thinks aloud: This is a thought.>
	// https://regex101.com/r/gII4uI/1
	let thoughtMatch = msg.match(/<(\w.+) (?:thinks|think) aloud: (.*)>/);
	if (injectedConfig.includeThoughts
		&& thoughtMatch 
		&& thoughtMatch.length >= 1) {
		outputMessage = `<div>[${timestamp}] ${thoughtMatch[0]}</div>`;
		shouldSendToComms = true;

		if (injectedConfig.removeThoughtsFromMain) {
			sendToOutput = false;
		}
	}

	// Example: <6:42 pm OOC> Someone says, "This is an OOC message."
	// https://regex101.com/r/FS2p0A/1
	//let oocMatch = msg.match(/<.+(?:OOC>) (\w+)(.+)/);
	let oocMatch = msg.match(/<.+(?:OOC&gt;) (\w+)(.+)/);
	if (injectedConfig.includeOOC
		&& oocMatch
		&& oocMatch.length >= 1) {
		outputMessage = `<div>[${timestamp}] ${oocMatch[0]}</div>`;
		shouldSendToComms = true;

		if (injectedConfig.removeOOCFromMain) {
			sendToOutput = false;
		}
	}

	/*
		Dig into whether or not this color is actually parseable:
			</font><font color="#FF69B4">&lt;Ciaran thinks aloud: This is your divine punishment for encouraging Chompers.&gt;</font>
	*/
	// Example: Someone say to SomeoneElse, "This is a speech message."
	// https://regex101.com/r/7NXKrH/1
	//let speechMatch = msg.match(/(.+)(?:, \")(.+\")/);
	let speechMatch = msg.match(/(.+)(?:, &quot;)(.+&quot;)/);
	if (injectedConfig.includeSpeech
		&& msg.indexOf('OOC>') == -1 
		&& speechMatch
		&& speechMatch.length >= 1) {

	    outputMessage = `<div>[${timestamp}] ${speechMatch[0]}</div>`;
			shouldSendToComms = true;

			if (injectedConfig.removeSpeechFromMain) {
				sendToOutput = false;
			}
	}

	if (shouldSendToComms) {
		outputComms(outputMessage);
	}

	return sendToOutput;
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

// Apply visual adjustments to page elements with injected configuration.
function applyConfigUpdate() {
	const comms = document.getElementById('comms');
	if (!comms){
		createCommsElement();
	}
	else if (comms) {
		updateCommsElement();
	}
}

/**
 * Create the Comms element with current configuration.
 */
function createCommsElement() {
	setTimeout(function () {
		const outputArea = document.getElementById("output");
		if (outputArea) {
			let display = injectedConfig.enableComms ? "inherit" : "none";

			// Insert UI elements above the macro area.
			document.getElementById("output").insertAdjacentHTML(
				"afterBegin",
				`
					<style>
						#comms {
							display: ${display};
							position: sticky;
							top: 0;
							height: ${injectedConfig.commsBoxHeight}px;
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

// Update the Comms element with current configuration.
function updateCommsElement() {
	const comms = document.getElementById('comms');
	comms.style.display = injectedConfig.enableComms ? "inherit" : "none";
	comms.style.height = `${injectedConfig.commsBoxHeight}px`;
}

/*********************************************************************************************/
/** Apply overrides, add event listeners, run initial setup via timeouts. **/

// Override the doReceive function on the page to intercept data, then send it on.
if (typeof doReceive !== "undefined") {
	const origDoReceive = doReceive;
	doReceive = function (msg) {
		doReceiveOverride(msg);

		// Pull out communication for the comms window, and determine if this message
		// should be sent to the main output window or not.
		const sendToOutput = pullCommunication(msg);

		if (sendToOutput) {
			origDoReceive.apply(this, arguments);
		}
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
		injectedConfig = config;
		applyConfigUpdate();
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

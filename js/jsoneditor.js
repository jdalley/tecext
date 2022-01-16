/**
 * JSON Editor Setup
 */

// create the editor
const container = document.getElementById("jsonEditor");
const options = {
	mode: "text",
	indentation: 4,
};
const editor = new JSONEditor(container, options);

// Load the current user scripts from the background:
chrome.runtime.sendMessage({ type: "popup-get-scripts" }, function (response) {
	// response will be an array of script objects
	if (response) {
		editor.set(response);
	}
	else {
		editor.set("No scripts found");
	}
});


/**
 *   This script handles the logic driving the Edit Scripts page:
 */

// Save changes to the script by calling the background save function:
document.getElementById("saveScript").addEventListener("click", function (e) {
	const scriptsJson = editor.get();
	if (scriptsJson) {
		chrome.runtime.sendMessage({ 
			type: "editor-set-scripts",
			message: scriptsJson
		});

		let editMessage = document.getElementById("editMessage");
		editMessage.innerHTML = "Script saved.";
		editMessage.className = "hidden";

		setTimeout(function() {
			editMessage.innerHTML = "";
			editMessage.className = "";
		}, 5000)
	}
});

// Close window:
document.getElementById("close").addEventListener("click", function (e) {
	close();
});


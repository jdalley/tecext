/*********************************************************************************************/
/* JSON Editor setup */

const editorTabUrl = "*://client.eternalcitygame.com/*";

// Create the editor
const container = document.getElementById("jsonEditor");
const options = {
	mode: "text",
	indentation: 4,
};
const editor = new JSONEditor(container, options);

// Load the current user scripts
chrome.tabs.query({ url: editorTabUrl }, function (tabs) {
	chrome.tabs.sendMessage(tabs[0].id, { type: "editor-get-scripts" }, 
		function (response) {
			if (response) {
				editor.set(response);
			}
			else {
				editor.set("No scripts found");
			}
		});
});

// Wait to grab Ids for adding event listeners
document.addEventListener("DOMContentLoaded", function () {
	// Save changes to the script by calling the background save function (via content.js)
	document.getElementById("saveScript").addEventListener("click", function (e) {
		const scriptsJson = editor.get();
		if (scriptsJson) {
			chrome.tabs.query({ url: editorTabUrl }, function (tabs) {
				chrome.tabs.sendMessage(tabs[0].id, { 
						type: "editor-set-scripts",
						message: scriptsJson
					})
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
});
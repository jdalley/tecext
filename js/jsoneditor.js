/*********************************************************************************************/
/* JSON Editor setup */

const editorTabUrl = "*://client.eternalcitygame.com/*";

// Create the editor
const container = document.getElementById("jsonEditor");
const options = {
	indentation: 2,
	theme: 'ace/theme/gruvbox',
	mode: 'code',
	modes: ['code', 'form', 'text', 'tree', 'view', 'preview'], // allowed modes
	onModeChange: function (newMode, oldMode) {
		console.log('Mode switched from', oldMode, 'to', newMode)
	}
};
const editor = new JSONEditor(container, options);

// 'code' mode themes, matching theme files in js/jsoneditor/theme.
// editor.aceEditor.setTheme('ace/theme/{theme-name}');
const themes = [
	"chaos",
	"dracula",
	"github_dark",
	"gruvbox",
	"kr_theme",
	"nord_dark",
	"one_dark",
	"pastel_on_dark",
	"solarized_dark",
	"solarized_light",
	"tomorrow_night",
	"twilight",
	"vibrant_ink"
];

// Hold configuration for the extension. 
let extConfig = null;

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

	// Hydrate theme select
	const themeSelect = document.getElementById("themeSelect");
	themeSelect.innerText = null;
	themes.forEach((element) => {
		const opt = document.createElement("option");
		opt.value = opt.innerHTML = element;
		themeSelect.appendChild(opt);
	});
	themeSelect.addEventListener("change", function(event) {
		if (event) {
			const theme = event.target.value;
			editor.aceEditor.setTheme(`ace/theme/${theme}`);
			
			if (extConfig) {
				// Save the selected theme to the extension's configuration.
				extConfig.aceTheme = theme;
				saveConfiguration(extConfig);
			}
		}
	});

	// Listener to handle requests from the background script:
	chrome.runtime.onMessage.addListener(function (
		request,
		sender,
		sendResponse
	) {
		if (request.msg === "config-saved-success") {
			let editMessage = document.getElementById("editMessage");
			editMessage.innerHTML = "Theme saved.";
			editMessage.className = "hidden";

			setTimeout(function() {
				editMessage.innerHTML = "";
				editMessage.className = "";
			}, 5000)		
		}
	});

	getConfiguration();
});

// Save configuration to local storage.
function saveConfiguration(config) {
	chrome.tabs.query({ url: editorTabUrl }, function (tabs) {
		chrome.tabs.sendMessage(tabs[0].id, {
			type: "popup-save-configuration",
			message: config,
		});
	});
}

// Pull configuration from local storage to use in setting extra properties of the window.
function getConfiguration() {
	chrome.tabs.query({ url: editorTabUrl }, function (tabs) {
		chrome.tabs.sendMessage(
			tabs[0].id,
			{ type: "popup-get-configuration" },
			function (response) {
				// Response will be a config object
				if (response) {
					extConfig = response;
					const body = document.getElementsByTagName("body")[0];

					if (response.darkModeEnabled) {
						if (!body.classList.contains("dark-mode")) {
							body.classList.add("dark-mode");
						}
					} else {
						if (body.classList.contains("dark-mode")) {
							body.classList.remove("dark-mode");
						}
					}

					if (response.aceTheme) {
						const themeSelect = document.getElementById("themeSelect");
						const themeOptions = Array.from(themeSelect.options);
						const optionToSelect = themeOptions.find(opt => opt.text === response.aceTheme);
						optionToSelect.selected = true;

						editor.aceEditor.setTheme(`ace/theme/${response.aceTheme}`);
					}
				}
			}
		);
	});
}
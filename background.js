/*********************************************************************************************/
/* Background (service worker), contains event handling only - no state or persistence. */

/**
 * Set up and open popout window.
 */
 function openPopupWindow() {
	chrome.windows.create(
		{
			url: chrome.runtime.getURL("popup.html"),
			type: "popup",
			height: 435,
			width: 750,
		},
		function (win) {
			// Do something with the new window?
		}
	);
}

// Open popout window when the main extension icon is clicked:
chrome.action.onClicked.addListener(function (tab) {
	openPopupWindow();
});

const getUserScripts = async () => {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get('userScripts', function(data) {
			if (data && data["userScripts"]) {
				userScripts = data["userScripts"];
				resolve(userScripts);
			} else {
				// No userScripts found or saved yet, load the default scripts
				fetch("/scripts/scriptCollection.json")
					.then((res) => res.json())
					.then((out) => {
						if (out) {
							userScripts = out;
							chrome.storage.local.set({ userScripts: out });
							resolve(userScripts);
						}
					});
			}
		});
	});
};

const getConfig = async () => {
	return new Promise((resolve, reject) => {
		let extConfig = {};
		chrome.storage.local.get('config', function(data) {
			if (data && data["config"]) {
				extConfig = data["config"];
				resolve(extConfig);
			}
			else {
				// No config found or saved yet, load default
				extConfig.enableComms = true;
				resolve(extConfig);
			}
		})
	});
}

const handleMessages = async (request, sender, sendResponse) => {
	switch (request.type) {
		case "background-get-user-scripts":
			let userScripts = await getUserScripts();
			sendResponse(userScripts);
			break;

		case "background-save-user-scripts":
			if (request.message) {
				chrome.storage.local.set({ userScripts: request.message });
				// Send message to popup that userScripts have been updated:
				chrome.runtime.sendMessage({
					msg: "reload-scripts-select",
				});
			}
			break;

		case "background-save-configuration":
			if (request.message) {
				chrome.storage.local.set({ config: request.message });
				// Send message to popup that config has been updated:
				chrome.runtime.sendMessage({
					msg: "config-saved-success"
				})
			}
			break;

		case "background-get-configuration":
			let extConfig = await getConfig();
			sendResponse(extConfig);
			break;

		case "background-open-edit-scripts":
			chrome.windows.create(
				{
					url: "edit-scripts.html",
					type: "popup",
					height: 1000,
					width: 900,
				},
				function (window) {}
			);
			break;

		default:
			console.log(`request.type not found: ${request.type}`);
	}
}

/**
 * Handle messages from other scripts
 */
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) { 
	handleMessages(request, sender, sendResponse);
	// Keep the messaging channel open for sending responses
	return true;
});
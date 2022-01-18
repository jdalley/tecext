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
			width: 399,
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
			} else {
				// No userScripts found or saved yet, load the default scripts
				fetch("/scripts/scriptCollection.json")
					.then((res) => res.json())
					.then((out) => {
						if (out) {
							userScripts = out;
							chrome.storage.local.set({ userScripts: out });
						}
					});
			}
			resolve(userScripts);
		});
	});
};

/**
 * Handle messages from other scripts
 */
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) { 
	(async () => {
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
	})();

	// Keep the messaging channel open for sending responses
	return true;
});
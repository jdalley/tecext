/**
 * Extension popup logic: event wireup and UI logic.
 * Events call functions directly in the background script.
 */

function resizeMe() {
    height = document.getElementsByClassName('popup-container')[0].offsetHeight;
    width  = document.getElementsByClassName('popup-container')[0].offsetWidth;
    self.resizeTo(width, height+50);
}

document.addEventListener('DOMContentLoaded', function () {

    // Plain message input:
    document.getElementById('sendCommand').addEventListener('click', function (e) {
        const command = document.getElementById('commandInput').value;

        if (command) {
            chrome.extension.getBackgroundPage().sendCommand(command);
        }
    });
    document.getElementById('commandInput').addEventListener('keydown', function (e) {
        if (e.keyCode == 13 && this.value) {
            chrome.extension.getBackgroundPage().sendCommand(this.value);
            this.value = '';
        }
    });

    // Simple command repeat, checks for no longer busy:
    document.getElementById('sendRepeat').addEventListener('click', function (e) {
        const repeatCommand = document.getElementById('repeatInput').value;
        if (repeatCommand) {
            chrome.extension.getBackgroundPage().runSimpleRepeat({
                command: repeatCommand
            });
        }
    });

    // Run the selected script by name, with options:
    document.getElementById('runScript').addEventListener('click', function (e) {
        const scriptName = document.getElementById('scriptSelect').value;
        const target = document.getElementById('targetInput').value;
        const weaponItemName = document.getElementById('weaponItemName').value;
        const shouldKill = document.getElementById('shouldKill').checked;
        const continueOnWalkIn = document.getElementById('continueOnWalkIn').checked;

        // This will become data driven later, via json/local storage with defaults.
        // TODO: Move options into its own JSON config, load it like scripts are loaded.
        chrome.extension.getBackgroundPage().runScriptByName(
            scriptName, {
                target: target,
                weaponItemName: weaponItemName,
                shouldKill: shouldKill,
                continueOnWalkIn: continueOnWalkIn
            }
        );
    });

    document.getElementById('stopScript').addEventListener('click', function (e) {
        // Kill any currently running script.
        chrome.extension.getBackgroundPage().killCurrentScript();
    });

    // Edit script modal
    document.getElementById('editScripts').addEventListener('click', function (e) {
        chrome.windows.create({
            'url': 'edit-scripts.html',
            'type': 'popup',
            height: 1000,
            width: 900
        }, function(window) {  });
    });

    // Listener to update the script select; expected to trigger from Edit Scripts window:
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            if (request.msg === 'reload-scripts-select') {
                loadScriptSelect();
            }
        }
    );

    // Initial scripts load:
    loadScriptSelect();
});

/**
 *  Load combat script choices from background page:
 */
function loadScriptSelect() {
    const select = document.getElementById('scriptSelect');
    // Clear select
    select.innerText = null;

    // Load scripts from background:
    const scripts = chrome.extension.getBackgroundPage().getCurrentScripts();
    if (scripts) {
        scripts.forEach(element => {
            const opt = document.createElement('option');
            opt.value = element.scriptName;
            opt.innerHTML = element.scriptFriendlyName;
            select.appendChild(opt);
        });
    }
}
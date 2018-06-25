/**
 * Extension popup logic: event wireup and UI logic.
 * Events call functions directly in the background script.
 */
document.addEventListener("DOMContentLoaded", function () {

    // Plain message input:
    document.getElementById("sendCommand").addEventListener("click", function (e) {
        var command = document.getElementById("commandInput").value;

        if (command) {
            chrome.extension.getBackgroundPage().sendCommand(command);
        }
    });
    document.getElementById("commandInput").addEventListener("keydown", function (e) {
        if (e.keyCode == 13 && this.value) {
            chrome.extension.getBackgroundPage().sendCommand(this.value);
            this.value = '';
        }
    });

    // Simple command repeat, checks for no longer busy:
    document.getElementById("sendRepeat").addEventListener("click", function (e) {
        // Grab value of repeat button:
        var scriptName = e.srcElement.value;
        var repeatCommand = document.getElementById("repeatInput").value;

        if (repeatCommand) {
            chrome.extension.getBackgroundPage().runScriptByName(
                scriptName, {
                    command: repeatCommand
                }
            );
        }
    });

    // Run the selected script by name, with options:
    document.getElementById("runScript").addEventListener("click", function (e) {
        var scriptName = document.getElementById("scriptSelect").value;
        var target = document.getElementById("targetInput").value;
        var weaponItemName = document.getElementById("weaponItemName").value;
        var shouldKill = document.getElementById("shouldKill").checked;

        // Will change, but for now we're assuming a script will at least need a target
        // and a weapon or item name to get started.
        if (target || weaponItemName) {
            // This will become data driven later, via json/local storage with defaults.
            // Options object will be expanded.
            chrome.extension.getBackgroundPage().runScriptByName(
                scriptName, {
                    target: target,
                    weaponItemName: weaponItemName,
                    shouldKill: shouldKill
                }
            );
        }
    });

    document.getElementById("stopScript").addEventListener("click", function (e) {
        // Kill any currently running script.
        chrome.extension.getBackgroundPage().killCurrentScript();
    });

});

/*
    This script handles the logic driving the Edit Scripts page:
*/
document.addEventListener("DOMContentLoaded", function () {

    // Load the current user scripts from the background:
    var currentScripts = JSON.stringify(chrome.extension.getBackgroundPage().currentScripts);
    document.getElementById("scriptJson").value = currentScripts;

    // Save changes to the script by calling the background save function:
    document.getElementById("saveScript").addEventListener("click", function (e) {

        var scriptsJson = JSON.parse(document.getElementById("scriptJson").value);

        if (script) {
            chrome.extension.getBackgroundPage().saveScripts(scriptsJson);
        }

        close();
    });

    // Close window:
    document.getElementById("cancel").addEventListener("click", function (e) {
        close();
    });

});
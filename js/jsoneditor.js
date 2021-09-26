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
const currentScriptsJson = chrome.extension
  .getBackgroundPage()
  .getCurrentScripts();
editor.set(currentScriptsJson);

/**
 *   This script handles the logic driving the Edit Scripts page:
 */
document.addEventListener("DOMContentLoaded", function () {
  // Save changes to the script by calling the background save function:
  document.getElementById("saveScript").addEventListener("click", function (e) {
    const scriptsJson = editor.get();
    if (scriptsJson) {
      chrome.extension.getBackgroundPage().saveScripts(scriptsJson);
    }

    close();
  });

  // Close window:
  document.getElementById("cancel").addEventListener("click", function (e) {
    close();
  });
});

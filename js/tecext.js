/*
  Extension popup logic.

*/

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("sendMessage").addEventListener("click", function () {
        var input = document.getElementById("messageInput");

        if (input.value) {
            chrome.extension.getBackgroundPage().sendCommand(input.value);
        }
    });

    document.getElementById("messageInput").addEventListener("keydown", function (e) {
        if (e.keyCode == 13 && this.value) {
            chrome.extension.getBackgroundPage().sendCommand(this.value);

            this.value = '';
        }
    });
    document.getElementById("sendRepeat").addEventListener("click", function () {
        var input = document.getElementById("repeatInput");

        if (input.value) {
            chrome.extension.getBackgroundPage().startRepeat(input.value);
        }
    });
    document.getElementById("stopRepeat").addEventListener("click", function () {
        chrome.extension.getBackgroundPage().stopRepeat();
    });

    document.getElementById("twoHandBasic").addEventListener("click", function () {
        var input = document.getElementById("targetInput");

        if (input.value) {
            chrome.extension.getBackgroundPage().twoHandBasic(input.value);
        }
    });

    document.getElementById("stopScripts").addEventListener("click", function () {
        chrome.extension.getBackgroundPage().killCommandScript();
    });

});

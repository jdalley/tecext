/*
  Extensions for the TEC HTML5 Client.

*/

var bkg = chrome.extension.getBackgroundPage();

// Run as soon as the document's DOM is ready.
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("sendMessage").addEventListener("click", function() {
    var input = document.getElementById("messageInput");

    if (input.value) {
      chrome.extension.getBackgroundPage().sendMessage(input.value);
    }
  });

  document.getElementById("messageInput").addEventListener("keydown", function(e) {
    if (e.keyCode == 13 && this.value) {
      chrome.extension.getBackgroundPage().sendMessage(this.value);

      this.value = '';
    }
  });
});


// Example code from KBMOD Ext for ref:

// Sets a given Streamer username from the current tab:
// Only intended to work if current tab is on a streamer's twitch page or profile.
function setCurrentStreamerName(e) {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, function(
    arrayOfTabs
  ) {
    var currTab = arrayOfTabs[0];

    if (currTab.url.indexOf("twitch.tv") > -1) {
      var streamId = e.target.id.slice(-1);
      var streamInput = document.getElementById("stream" + streamId);

      var twitchUser = currTab.url.replace("/profile", "");
      twitchUser = twitchUser.substr(twitchUser.lastIndexOf("/") + 1);
      streamInput.value = twitchUser;

      saveStreams(e);
    }
  });
}

// Save a given streamer username to storage.
function saveStreams(e) {
  var streamId = "stream" + e.target.id.slice(-1);
  var streamInput = document.getElementById(streamId);

  var obj = {};
  obj[streamId] = streamInput.value;
  chrome.storage.sync.set(obj, function() {
    return false;
  });
}

// Retrieve and set a given streamer username from storage.
function loadStreamValue(streamIndex) {
  var streamId = "stream" + streamIndex;
  var streamInput = document.getElementById(streamId);

  chrome.storage.sync.get(streamId, function(data) {
    if (data[streamId]) {
      streamInput.value = data[streamId];
    }
  });
}

// Clear a given streamer username input box.
function clearCurrentStreamerName(e) {
  var streamToClear = document.getElementById("stream" + e.target.id.slice(-1));
  streamToClear.value = "";
  saveStreams(e);
}

// Construct a KBMOD MultiStream link from filled-in streamer usernames.
function openMultiStream() {
  var msUrl = "https://multistre.am/";

  var inputs = document.getElementsByClassName("stream-input");
  var numInputs = inputs.length;

  for (var i = 0; i < numInputs; i++) {
    if (inputs[i].value) {
      msUrl += inputs[i].value + "/";
    }
  }

  // Just default to layout0
  msUrl += "layout0";

  // Launch a new chrome tab with the newly constructed KBMOD MS Url.
  chrome.tabs.create({
    url: msUrl
  });
}

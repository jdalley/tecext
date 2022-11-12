# TEC Extender

Extensions and goodies for The Eternal City's Orchil client: http://client.eternalcitygame.com/tec/tec.htm

## Installation
### Walkthrough & Guide
Here's a GREAT walkthrough written by JagerBtFM which does a much better job than the descriptions below of explaining how to get up and running with the extension. Thanks Jager!

https://docs.google.com/document/d/1s0jJVMRsAlHK2J7mT21lr1SA6segsAIY/edit

### Chrome Web Store
The TEC Extender is now on the Chrome Web Store! Grab it here if you prefer to have it auto update over time and not manually install a specific version: https://chrome.google.com/webstore/detail/tec-extender/aegdmagbofbclblaidikleeophbplmad

**Note:** As it takes time for new versions to be approved on the web store, this version may be behind compared to what can be found here on GitHub. If you find it's missing features, you can always uninstall it temporarily and grab the latest version here instead. 

### Manual Installation Instructions
After cloning/downloading a copy of this repository:

1. Navigate to ```chrome://extensions```
2. Make sure Developer Mode is turned on in the top right.
3. Click Load unpacked in the top left.
4. In the file browser, navigate to the root of this project directory on your machine, then click Ok.
5. The extension is now installed - and it can be accessed by the TEC icon in the extension icon area, or by right clicking anywhere in the Orchil client and clicking '[TEC] Open UI...'

You should see something like this under chrome://extensions if all goes well:

![Extensions](https://github.com/jdalley/tecext/blob/main/images/extensions.png)

## UI and Scripts

The UI for the extension's popup (after clicking on its icon in the Chrome extension menu bar in the top right), looks like this:

![Extension UI](https://user-images.githubusercontent.com/232725/201486465-afda359a-942f-4f3a-a906-99d6878e9bed.png "Extension UI")

* Send command does exactly what you'd think, you can enter commands to be sent to the server. Typing in this box and hitting enter will send, then clear the input so you can use it like the normal input in Orchil. If you leave something in the box, then click send - it stays in the box.
* Repeat will take whatever command you input, and repeat it on 'No longer busy'. Useful for simple stuff.
* Edit Scripts opens up another window with a really simple JSON editor; you can make your changes to scripts, add new ones etc. When you click Save, it will write the whole script to local storage in chrome, and next time you launch it it'll check there before loading the scriptCollection.json.
    * After Save is clicked, the `Choose a script to run` dropdown is now updated with your new or updated script.

		![Edit Scripts UI](https://user-images.githubusercontent.com/232725/201486550-78cfb7a2-8b70-437e-9f93-18a729921d82.png "Edit Scripts UI")


* The `Choose a script to run` dropdown starts off with a list of script examples that I continually update, found in this repo at [scripts/scriptCollection.json](scripts/scriptCollection.json).
    * Weapon/item name: this input is used in scripts as the name of your weapon in case you drop it - it will pick it back up and wield it.
		* Shield: this input is similar to weapon/item, and is used to identify the name of your shield so it can be picked up & wielded when disarmed or knocked away.
    * Target name: this input is used in two different ways:
        * With combat scripts, it will be added to the end of your commands: slash target, ie: slash dog|rat.
        * With any script, you can place `<target>` anywhere in a command, and it will be replaced by whatever is in the target input. ie: if 'right arm' is in the input, "command": "bandage `<target>` with bandages" will be: bandage right arm with bandages.
    * Use kill on KO: This does what you'd expect, if you're using a combat script and you want it to automatically use 'kill' when something goes unconscious, it'll do so.
    * Continue on 'walks in': Again, does what you'd expect; for combat scripts it attempts to detect if something walks in/arrives, so if you're in a single combat area waiting for spawns it can continue on its own.
        * Similar to use kill on KO, this will get triggered if ANYTHING walks in or arrives, even another player. It will not target that player - and the worst case scenario here is it just resumes the script with your intended target. So you'll see it try to use the next move even if no target is there. I could fix this similarly to use kill on KO eventually.
* Run Script: clears all current values of any in-progress scripts, and uses the weapon/target to start the selected script from scratch.
* Pause/Resume Script: self explanatory, for pausing and resuming the current script.
* Stop Script: stops the currently running script, and clears all current values set by that script.

You can also get to the 'Edit Scripts' popup by clicking on the following button that appears above the macro section:  

![image](https://user-images.githubusercontent.com/232725/85637391-b0e63980-b648-11ea-801f-0fe4338437e9.png)

## Slash Commands

Additionally, there are some slash commands you can enter in the game input to take advantage of some features without leaving the input. Type `/help` to view available command information, where you'll get output like this in red text:

![The /help slash command output](https://user-images.githubusercontent.com/232725/201486934-79de82df-c736-4f6d-8cda-5222c6f9d865.png "The /help slash command output")

You can get a list of current scripts available with `/scripts`:

![Example available scripts list from /scripts command](https://user-images.githubusercontent.com/232725/85637298-78466000-b648-11ea-919d-8eb24d2bc1d2.png "Example available scripts list from /scripts command")

Here are a few examples for the `/start` command:
- `/start twohandcore dog|rat two-handed`
- `/start outdoorsBasic`
  - In this case you can see the target/weaponItemName are not added, this is because they aren't required for nonCom type scripts (check the example scripts for an example of nonCom vs combat).
Any command starting with a forward slash is not sent to the TEC server, instead it's interpreted by the extension. Additionally, all messages from the extension will be in a consistent red text with a smaller font size to distinguish it.


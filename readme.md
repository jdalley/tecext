## TEC Extender

Extensions and goodies for The Eternal City's Orchil client: http://client.eternalcitygame.com/tec/tec.htm

### Installation Instructions

After cloning/downloading a copy of this repository:

1. Navigate to ```chrome://extensions```
2. Make sure Developer Mode is turned on in the top right.
3. Click Load unpacked in the top left.
4. In the file browser, navigate to the root of this project directory on your machine, then click Ok.
5. The extension is now installed - and it can be accessed by the TEC icon in the extension icon area, or by right clicking anywhere in the Orchil client and clicking '[TEC] Open UI...'

You should see something like this under chrome://extensions if all goes well:

![Extensions Example](https://github.com/jdalley/tecext/blob/master/images/extensions.png "Extensions Example")


### Debugging and Viewing Commands for Debugging

1. Make sure you have Orchil opened in your browser, if you installed the extension after having it open you'll have to refresh the page (ctrl + F5 for a no-cache reload).
2. In chrome://extensions, in the TEC Extender block, you should see 'Inspect views background page', click on background page:
    1. The Developer Tools window, and in the Console you'll see output received from the TEC server with all its raw HTML/CSS.
    2. You'll also see some feedback from the scripts being run at the time such as the commands being sent to the server, and some other debugging information.

Here's an example of what you'll see in the Dev Tools window:

![Background Dev Tools](https://github.com/jdalley/tecext/blob/master/images/backgroundtools.png "Background Dev Tools")

### UI and Scripts

The UI is very much temporary and doesn't make a ton of sense, so let's called it mega-alpha for now.

![Extension UI](https://github.com/jdalley/tecext/blob/master/images/mainui.png "Extension UI")


* Send command does exactly what you'd think, you can enter commands to be sent to the server. Typing in this box and hitting enter will send, then clear the input so you can use it like the normal input in Orchil. If you leave something in the box, then click send - it stays in the box.
* Repeat will take whatever command you input, and repeat it on 'No longer busy'. Useful for simple stuff.
* Edit Scripts opens up another window with a really simple JSON editor; you can make your changes to scripts, add new ones etc. When you click Save, it will write the whole script to local storage in chrome, and next time you launch it it'll check there before loading the scriptCollection.json.
    * After Save is clicked and the window closes, you'll notice if there wasn't a parsing error with the JSON, the Choose a script to run dropdown is now updated with your new script.

    ![Edit Scripts UI](https://github.com/jdalley/tecext/blob/master/images/editscripts.png "Edit Scripts UI")

* The Choose a script to run dropdown starts off with a list of script examples that I continually update, found in this repo at [scripts/scriptCollection.json](scripts/scriptCollection.json).
    * Weapon/item name: this input is used in combat scripts as the name of your weapon in case you drop it - it will pick it back up and wield it.
        * This does not work if you get disarmed and suddenly "you can't do that right now" or variants of that.
        * It is currently not used for nonCom scripts.
    * Target name: this input is used in two different ways:
        * With combat scripts, it will be added to the end of your commands: slash target, ie: slash dog|rat.
        * With any script, you can place \<target\> anywhere in a command, and it will be replaced by whatever is in the target input. ie: if 'right arm' is in the input, "command": "bandage <\target\> with bandages" will be: bandage right arm with bandages.
    * Use kill on KO: This does what you'd expect, if you're using a combat script and you want it to automatically use 'kill' when something goes unconscious, it'll do so.
        * It's worth noting there is no special sauce right now preventing this from being triggered if something you're not attacking/approached to falls unconscious - it'll still try to kill it. In this case you'll have to stop/start the script to get it going again. I have some ideas for how to fix it, I could just put a "Next" button to skip to the next command in the queue, but I was thinking about solving it automagically (regex with your target input) at some point.
    * Continue on 'walks in': Again, does what you'd expect; for combat scripts it attempts to detect if something walks in/arrives, so if you're in a single combat area waiting for spawns it can continue on its own.
        * Similar to use kill on KO, this will get triggered if ANYTHING walks in or arrives, even another player. It will not target that player - and the worst case scenario here is it just resumes the script with your intended target. So you'll see it try to use the next move even if no target is there. I could fix this similarly to use kill on KO eventually.
* Run Script: clears all current values of any in-progress scripts, and uses the weapon/target to start the selected script from scratch.
* Stop Script: stops the currently running script, and clears all current values set by that script.

You can also get to the 'Edit Scripts' popup by clicking on the following button that appears above the macro section:  

![image](https://user-images.githubusercontent.com/232725/85637391-b0e63980-b648-11ea-801f-0fe4338437e9.png)

### Slash Commands

Additionally, there are some slash commands you can enter in the game input to take advantage of some features without leaving the input. Type `/help` to view available command information, where you'll get output like this in red text:

![image](https://user-images.githubusercontent.com/232725/85637288-71b7e880-b648-11ea-9348-1d614da65597.png)

You can get a list of current scripts available with `/scripts`:

![image](https://user-images.githubusercontent.com/232725/85637298-78466000-b648-11ea-919d-8eb24d2bc1d2.png)

Because it's not super intuitive here's a few examples for the `/start` command:
- `/start twohandcore dog|rat two-handed`
- `/start outdoorsBasic`
  - In this case you can see the target/weaponItemName are not added, this is because they aren't required for nonCom type scripts (check the example scripts for an example of nonCom vs combat).
Any command starting with a forward slash is not sent to the TEC server, instead it's interpreted by the extension. Additionally, all messages from the extension will be in a consistent red text with a smaller font size to distinguish it.


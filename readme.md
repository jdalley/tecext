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

![Extension UI](https://user-images.githubusercontent.com/232725/201487061-5365f5cc-5c0a-43bb-8260-ab4cd386bee6.png "Extension UI")

### Configuration Tabs

 * The Comms tab configures the feature where a window is added to the top of Orchil, and communications are added to it (and optionally removed from the main window) based on your choices. Thoughts, OOC, and Speech are supported at the moment. You can also set the size of the window's height in pixels, and optionally provide a comma-separated list of player names to mute from Thoughts & OOC.
* The Combat tab contains some options used specifically while running combat scripts:
  * Use kill on KO: This does what you'd expect, if you're using a combat script and you want it to automatically use 'kill' when something goes unconscious, it'll do so.
  * Continue on 'walks in': Again, does what you'd expect; for combat scripts it attempts to detect if something walks in/arrives, so if you're in a single combat area waiting for spawns it can continue on its own.
    * Similar to use kill on KO, this will get triggered if ANYTHING walks in or arrives, even another player. It will not target that player - and the worst case scenario here is it just resumes the script with your intended target. So you'll see it try to use the next move even if no target is there. I could fix this similarly to use kill on KO eventually.
  * Use Backwards Rise to stand: this will use the `brise` command to stand (instead of `stand`) if you have this skill trained up enough to use it reliably.		
  * Use Melee Advance (instead of engage): this will use the `advance` command instead of `engage` if you have enough ranks to use it effectively.
* The General tab contains options not specific to the other categories:
  * Cmd Delay Range (ms): this range is the number of milliseconds the script running code will use between sending commands. This helps avoid the server swallowing commands that would otherwise be sent too quickly after one another. This can be adjusted higher if you're on a bad or unreliable internet connection.  
  * Dark Mode: this enables poor man's dark mode for the extension windows (sorry, not super visually appealing, but at least it won't blind you as much).  

### Main Input and Control
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
* Run Script: clears all current values of any in-progress scripts, and uses the weapon/target to start the selected script from scratch.
* Pause/Resume Script: self explanatory, for pausing and resuming the current script.
* Stop Script: stops the currently running script, and clears all current values set by that script.

You can also get to the 'Edit Scripts' popup by clicking on the following button that appears above the macro section:  

![image](https://user-images.githubusercontent.com/232725/85637391-b0e63980-b648-11ea-801f-0fe4338437e9.png)

## Script Syntax

The following are example scripts of each type (Combat and Non-Combat), with comments above the keywords to explain their usage. Note that the best way to practice and learn how to utilize these is to reference existing default scripts while experimenting with your own!

### Combat Script

Combat scripts have special handling logic, which has automatic handling for certain scenarios like:
* dropping your weapon or shield; picks it up and wields it 
* being unable to perform an attack due to being entangled; sends `free` 
* automatically engage enemies when they aren't close enough to hit
  * will use melee advance instead if turned on in settings
* continuing the script if you get stunned
* being knocked down; stands you up using either `stand` or `brise`
* correctly wielding weapons when told "You must be wielding..."
* if melee advance is turned on, uses it when told `You'll have to retreat first`
* handles moving you into a normal stance if told you're in berserk/defensive
  * this may happen if trying to do a stance-changing attack and failing 

```json
{
  // Adds the innate `attack` command to your rotation, useful if you don't know many 
  // attacks yet.
  "addAttack": false,
  // The list of commands you want to run, in the order they'll run
  // Note: all scripts loop unless you add a command: `"/stop"`
  "commandList": [
    {
      // The text that will be sent to the game when this command runs.
      // Note: the use of `<target>` here is not the in-game target - but the one you set
      // when starting your script using the extension. It will be replaced and is often
      // used if you want to add it in the middle of a command instead of at the end 
      // (where it's added automatically).
      "command": "pslash <target> high",
      // One or more set of outcomes that the script will look for in the game's output
      // in order to decide when to move to the next command.
      // Note: some `parse`s have square brackets (denoting a list) like this one. This
      // is to tell the script to check more than one possible outcome to check for
      // the command.
      "parse": [
        {
          // If the `outcome` below this has happened already, this is the text that
          // actually causes the script to move to the next command.
          "moveNextWhen": "You are no longer busy",
          // The text the script is looking for from the game output to flag that it's
          // now time to begin moving to the next command.
          "outcome": "Sliding your front leg back"
        },
        {
          "moveNextWhen": "You are no longer busy",
          "outcome": "You start to fumble"
        }
      ]
    },
    {
      // This is an example of a command that doesn't need to aim high, and without 
      // including `<target>`, the script will add the target after the command 
      // automatically when it sends it to the game.
      "command": "upslash",
      // This is an example of a single parse outcome to check.
      "parse": {
        "moveNextWhen": "You are no longer busy",
        "outcome": "You twist your wrists"
      }
    },
    {
      "command": "strike <target> high",
      "parse": [
        {
            "moveNextNow": true,
            "outcome": "is not wielding anything"
        },
        {
            "moveNextWhen": "You are no longer busy",
            "outcome": "With a quick snapping motion, you"
        }
      ]
      }
  ],
  // If this is true, the script will run the current command when an enemy walks into
  // the area, arrives, or appears in some other fashion. Without this, the script 
  // will essentially stop until it finds the current 'outcome' it's looking for. 
  "continueOnWalkIn": true,
  // This appears as the longer name in the UI describing the purpose of your script.
  "scriptFriendlyName": "Spear Hunting - Aim High",
  // Short name for the script used in slash commands and internally to identify the 
  // script. This must be unique among all scripts.
  "scriptName": "spearHuntHigh",
  // Denotes this as a combat script
  "scriptType": "combat",
  // If true, the script sends the `kill` command when your target falls unconscious.
  "shouldKill": true,
  // This is the `outcome` the script looks for to identify when you've successfully
  // killed a target with the `kill` command, and will continue the next command.
  "shouldKillParse": "You thrust your",
  // If you don't have stance mastered so it auto-assumes, this command will be used
  // to enter your stance when the game tells you `You are not in the correct stance`.
  "stanceCommand": "scorpion"
},
```

### Non-Combat Scripts

The Non-Combat script type shares most of the commands/syntax and interpretations with the combat scripts. However, you'll note there is some combat-script specific syntax in the above examples that are not used in nonCom scripts, like `addAttack`, `continueOnWalkIn`, `shouldKill`, and `shouldKillParse`.

These scripts are more simplistic and generic, and don't have all the automatic scenario handling that combat scripts have.

Note that all of the comments and features mentioned below are also available for Combat scripts, I'm just separating the explanations as the Combat example is very busy.

```json
{
  "commandList": [
    {
      "command": "bait pole with worm",
      "parse": [
        {
          "moveNextWhen": "You are no longer busy",
          "outcome": "You bait a"
        },
        {
          // This causes the script to immediately send the next command after it detects
          // the `outcome` below, as opposed to waiting for `moveNextWhen`.
          // Note: this replaces the use of `moveNextWhen`, and they shouldn't be used
          // together inside any one `parse`.
          "moveNextNow": true,
          "outcome": "is already baited"
        }
      ]
    },
    {
      "command": "cast pole",
      "parse": {
        "moveNextWhen": "You are no longer busy",
        "outcome": "no longer has any bait on it"
      }
    }
  ],
  "scriptFriendlyName": "Fish With Worms",
  "scriptName": "fishworms",
  // Denotes this as a Non-Combat script
  "scriptType": "nonCom"
},
```

```json
{
  "commandList": [
    {
      "command": "echo <target>",
      "parse": {
        "moveNextWhen": "Now you repeat it",
        // If you leave outcome empty like this, the script will not try to check for an outcome, 
        // and will just immediately move to the next command when it detects `moveNextWhen`.
        // This is useful if your intent is to immediately repeat a command or move to the next
        // one without needing to wait for a second condition like "You are no longer busy".
        "outcome": ""
      }
    }
  ],
  "scriptFriendlyName": "Language Echo",
  "scriptName": "languageEcho",
  "scriptType": "nonCom"
},
```

```json
{
  "commandList": [
    {
        "command": "palm",
        "parse": [
            {
                "moveNextWhen": "You are no longer busy",
                // Players will be aware you can use the | character in game to collect multiple
                // things to look for into one command, this works similarly. Adding | between
                // outcomes is a replacement for having multiple parses in some cases. In this
                // specific case I'm using a mix of `moveNextWhen` and `moveNextNow`, so I still
                // need multiple parses, but if I only needed one of them, I could use this 
                // feature to shorten my script to one parse!
                "outcome": "You very nimbly palm|You barely manage to palm|You nearly drop a|You manage to palm"
            },
            {
                "moveNextNow": true,
                "outcome": "You are already palming that"
            }
        ]
    },
    {
        "command": "unpalm",
        "parse": {
            "moveNextNow": true,
            "outcome": "You flip your wrist"
        }
    }
  ],
  "scriptFriendlyName": "Palming",
  "scriptName": "palming",
  "scriptType": "nonCom"
},
```

```json
{
  "commandList": [
    {
      "command": "wait for ferry",
      "parse": [
        {
          "moveNextNow": true,
          // `<target>` can also be used in `outcome`, again this is the script target not
          // the in-game target.
          "outcome": "Next destination is <target>"
        },
        {
          "moveNextNow": true,
          "outcome": "You arrive at an a small river ferry"
        }
      ],
      // This tells the script not to add your current script-set `target` to the end of the
      // command. This is useful for commands that do not need a target at the end or 
      // anywhere in the middle using `<target>`.
      // Note: this works with combat scripts as well, and can be seen by example in the
      // default archery scripts for loading a bow.
      "targetRequired": false
    },
    {
      "command": "wait for dock",
      "parse": [
        {
          "moveNextNow": true,
          "outcome": "You arrive at"
        }
      ],
      "targetRequired": false
    },
    {
      // This is a good example of some extra flexibility that the extension's slash commands
      // offer. In this case we're stopping the script (it won't loop) after we get to this 
      // command, but you can imagine instead using `/start` to chain into a second script!
      "command": "/stop",
      "parse": {
        "moveNextWhen": "Never",
        // When stopping a script like this, I've opted to put text I don't expect to be 
        // read from the game in here so things don't break, this isn't strictly necessary
        // however.
        "outcome": "Nothing"
      },
      "targetRequired": false
    }
  ],
  "scriptFriendlyName": "Ferry To <target>",
  "scriptName": "ferry",
  "scriptType": "nonCom"
},
```

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


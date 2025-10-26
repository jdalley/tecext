# TEC Extender

Extensions and goodies for The Eternal City's Orchil client: http://client.eternalcitygame.com/tec/tec.htm. 

If you're looking to check out the game, the best place to start is the wiki: http://eternal-city.wikidot.com/. Here you'll find links to the community Discord, and information on how to get started.

## Installation
### Walkthrough & Guide
Here's a GREAT walkthrough written by JagerBtFM which does a much better job than the descriptions below of explaining how to get up and running with the extension. Thanks Jager!

https://docs.google.com/document/d/1s0jJVMRsAlHK2J7mT21lr1SA6segsAIY/edit

**Note**: The manual installation process has changed since this document was written, please see [Manual Installation Instructions](#manual-installation-instructions) for more details.

### Chrome Web Store
The TEC Extender is now on the Chrome Web Store! Grab it here if you prefer to have it auto update over time and not manually install a specific version: https://chrome.google.com/webstore/detail/tec-extender/aegdmagbofbclblaidikleeophbplmad

**Note:** As it takes time for new versions to be approved on the web store, this version may be behind compared to what can be found here on GitHub. If you find it's missing features, you can always uninstall it temporarily and grab the latest version here instead. 

### Manual Installation Instructions
**Updated 04/13/2024**  
These instructions have been updated, see below for updated steps to install the extension manually from this repository.

1. Navigate to https://github.com/jdalley/tecext/releases and download the latest release's `tecext_<version>.zip` file, and extract it.
2. Navigate to ```chrome://extensions```
3. Make sure Developer Mode is turned on in the top right.
4. Click Load unpacked in the top left.
5. In the file browser, navigate to the folder you extracted in step 1 and then click Ok.
6. The extension is now installed - and it can be accessed by the TEC icon in the extension icon area, or by right clicking anywhere in the Orchil client and clicking '[TEC] Open UI...'

You should see something like this under chrome://extensions if all goes well:

![Extensions](https://github.com/jdalley/tecext/blob/main/images/extensions.png)

## UI and Scripts

The UI for the extension's popup (after clicking on its icon in the Chrome extension menu bar in the top right), looks like this:

<img width="734" height="467" alt="Extension popup UI" src="https://github.com/user-attachments/assets/c3cfe62e-9e80-446e-9b60-7f5fc418afc4" />

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
* **Send** does exactly what you'd think, you can enter commands to be sent to the server. Typing in this box and hitting enter will send, then clear the input so you can use it like the normal input in Orchil. If you leave something in the box, then click send - it stays in the box.
* **Repeat** will take whatever command you input, and repeat it on 'No longer busy'. Useful for simple stuff.
* **Edit Scripts** opens up another window with a really simple JSON editor; you can make your changes to scripts, add new ones etc. When you click Save, it will write the whole script to local storage in chrome, and next time you launch it it'll check there before loading the scriptCollection.json.
  * After Save is clicked, the `Choose a script to run` dropdown is now updated with your new or updated script.

	<img width="884" height="992" alt="Edit scripts UI" src="https://github.com/user-attachments/assets/4a8efb97-e7f8-4558-ba0d-565cd4a3ae5a" />

* The **Choose a script to run** dropdown starts off with a list of script examples that I continually update, found in this repo at [scripts/scriptCollection.json](scripts/scriptCollection.json).
  * **Weapon/item name**: this input is used in scripts as the name of your weapon in case you drop it - it will pick it back up and wield it.
  * **Shield**: this input is similar to weapon/item, and is used to identify the name of your shield so it can be picked up & wielded when disarmed or knocked away.
  * **Target**: this input is used in two different ways:
    * With combat scripts, it will be added to the end of your commands: slash target, ie: slash dog|rat.
    * With any script, you can place `<target>` anywhere in a command, and it will be replaced by whatever is in the target input. ie: if 'right arm' is in the input, "command": "bandage `<target>` with bandages" will be: bandage right arm with bandages.
* **Run Script**: clears all current values of any in-progress scripts, and uses the weapon/target to start the selected script from scratch.
* **Pause/Resume Script**: self explanatory, for pausing and resuming the current script.
* **Stop Script**: stops the currently running script, and clears all current values set by that script.

You can also get to the 'Edit Scripts' popup by clicking on the following button that appears above the macro section:  

![image](https://user-images.githubusercontent.com/232725/85637391-b0e63980-b648-11ea-801f-0fe4338437e9.png)

## Slash Commands

Slash commands can be entered directly into Orchil's command input box, and allow you to take advantage of some features without leaving the input (handy!). Any command starting with a forward slash is not sent to the TEC server, instead it's interpreted by the extension. 

Type `/help` to view available command information, where you'll get output like this in red text:

<img width="597" height="461" alt="The /help slash command output" src="https://github.com/user-attachments/assets/b460fb5e-2d14-4563-a3b9-f297596d64ad" />

You can get a list of current scripts available with `/scripts`:
- Note: you can filter the list with a keyword such as `/scripts spear`, which will return only scripts whose scriptName contains 'spear'.

![Example available scripts list from /scripts command](https://user-images.githubusercontent.com/232725/85637298-78466000-b648-11ea-919d-8eb24d2bc1d2.png "Example available scripts list from /scripts command")

Here are a few examples for the `/start` command:
- `/start twohandcore dog|rat two-handed`
- `/start outdoorsBasic`
  - In this case you can see the target/weaponItemName are not added, this is because they aren't required for nonCom type scripts (check the example scripts for an example of nonCom vs combat).

## Script Syntax

The following are example scripts of each type (Combat and Non-Combat), with comments above the keywords to explain their usage. Note that the best way to practice and learn how to utilize these is to reference existing default scripts while experimenting with your own!

### Combat Scripts

Combat scripts have special handling logic, which has automatic handling for certain scenarios like:
* dropping your weapon or shield; picks it up and wields it 
* being unable to perform an attack due to being entangled; sends `free` 
* automatically engage enemies when they aren't close enough to hit
  * will use melee advance instead if turned on in settings
* continuing the script if you get stunned
* being knocked down; stands you up using either `stand` or `brise`
* correctly wielding weapons when told `You must be wielding...`
* if melee advance is turned on, uses it when told `You'll have to retreat first`
* handles moving you into a normal stance if told you're in berserk/defensive
  * this may happen if trying to do a stance-changing attack and failing 

```jsonc
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
  // If this command is present in a script and has a non-empty/non-null value, it will
  // be used INSTEAD of the `kill` command when an enemy falls unconscious.
  "customKillCommand": "fslash",
  // This is the `outcome` the script looks for to identify when you've successfully
  // killed a target with the `customKillCommand` command, and will continue the next
  // command.
  "customKillCommandParse": "Your blade cuts cleanly through",
  // If you don't have stance mastered so it auto-assumes, this command will be used
  // to enter your stance when the game tells you `You are not in the correct stance`.
  "stanceCommand": "scorpion",
  // If this command is used in a script, it will replace the usage of the `free` 
  // command when your weapon is entangled.
  // The commands work in the following ways:
  //  - Note: `fling` is an example, you would replace this with your freeing ability.
  //  - "fling <weapon>": You need to literally use <weapon> here, and it'll be replaced
  //    dynamically with what is entered as your weapon name when starting the script.
  //  - "fling gladius": You can 'hard-code' the name of your weapon here and it'll use it.
  //  - "fling": This will work as expected if the ability doesn't need to also target
  //    your weapon by name.
  "entangledCommand": "fling <weapon>"
},
```

### Non-Combat Scripts

The Non-Combat script type shares most of the commands/syntax and interpretations with the combat scripts. However, you'll note there is some combat-script specific syntax in the above examples that are not used in nonCom scripts, like `addAttack`, `continueOnWalkIn`, `shouldKill`, and `shouldKillParse`.

These scripts don't have all the automatic scenario handling that combat scripts have, and are meant to be more open-ended and multi-purpose.

The following are a series of example scripts broken out and separated to explain different available syntax and their purposes.
- It's highly recommended to read through all of these to understand what options you have available to you when writing your scripts.
- **Note**: all of the syntax/features mentioned below are also available for Combat scripts, I'm just separating the explanations as the Combat example is very busy.

```jsonc
{
  "commandList": [
    {
      "command": "bait pole with worm",
      // This causes a 5 second delay (in milliseconds) before running the next command after
      // the `outcome` conditions of this command are met.
      // Note: This can be used with both nonCom and combat scripts.
      "delayBeforeNext": 5000, 
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
      // If you use this within a command for either a nonCom or a combat script, it will 
      // effectively override the global Cmd Retry (ms) setting for the extension.
      // Usage examples:
      //    1. You may want to use this if you know the command's parse could take a while and
      //    you think it could get stuck. You'd set a custom value to move on to the next
      //    command after X milliseconds.
      //    2. You may want to keep a global Cmd Retry (ms) value configured for most scripts,
      //    but have the option to override it to NOT retry for a command you expect to run
      //    for a long time and are confident it'll finish.
      // Options:
      //    1. Setting it to 0 turns the retry off (it will ignore the global Cmd Retry (ms))
      //    2. Setting it to any positive number will use that number of milliseconds
      //    instead of the globally defined Cmd Retry (ms) value.
      "commandRetryMs": 0,
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

```jsonc
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

```jsonc
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
          // need multiple parses, but otherwise I could use this feature to shorten my 
          // script to one parse!
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

```jsonc
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
```jsonc
	{
    "commandList": [
      {
        // This is the Counter feature; its primary use is in scripts for skinning and looting
        // or any task that you want to repeat only a certain number of times.
        // 
        // This feature is enabled if two things are true:
        //    1. <counter> is present in at least one command within the commandList of a script.
        //    2. The `Script Counter Stop At` value is set to a value greater than 0.
        //        a. This setting lives under the General tab in the popup UI.
        //        b. It can also be managed via the /counterstopat or /csa commands, see /help for syntax.
        //        c. Once you set its value, it'll be used for _any_ script that uses a <counter> variable.
        //        So you'll want to be updating it for your needs depending on how many times you want the 
        //        script to run through its commandList. Ie: 20 for 20 things to skin or loot in the room. 
        "command": "skin <counter> corpse",
        "parse": {
          "moveNextNow": true,
          "outcome": "There isn't anything worth skinning on it"
        }
      }
    ],
    "scriptFriendlyName": "Skin - Everything",
    "scriptName": "skin",
    "scriptType": "nonCom"
  },
```

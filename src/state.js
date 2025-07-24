/**
 * This class is used for encapsulating the state used in the extension's scripts.
 * It is loaded with the extension's configuration and user script data.
 */
export class State {
	constructor() {
		// Store scripts separately from the cache due to potential size.
		this.userScripts = null;
		// Configuration used to set options for the extension, controlled in the popup.
		this.extConfig = null;	
		// Simple repeat
		this.repeatCommand = null;
		this.runRepeat = false;
		// Repeat constantly with a delay
		this.repeatWithDelayCommand = null;
		this.runRepeatWithDelay = false;
		// General
		this.currentCmdIndex = 0;
		this.currentMoveNextWhen = null;
		this.commandList = [];
		this.commandOverride = null;
		this.defaultCommandDelayMin = 900;
		this.defaultCommandDelayMax = 1100;
		this.defaultCommandRetryMs = 60000;
		this.delayNextCommandBy = 0;
		this.lastCommandRan = null;
		this.moveNextNow = false;
		this.target = null;
		// Combat
		this.addAttack = false;
		this.advancingToKill = false;
		this.attemptingKill = false;
		this.continueOnWalkIn = false;
		this.shieldItemName = null;
		this.shouldKill = false;
		this.shouldKillParse = null;
		this.customKillCommand = null;
		this.customKillCommandParse = null;
		this.stance = null;
		this.entangledCommand = null;
		this.weaponItemName = null;
		this.recoveringWeapon = false;
		// Scripts
		this.currentScript = null;
		this.currentScriptName = null;
		this.currentScriptType = null;
		this.scriptPaused = false;
		this.lastCommandSent = null;
	}

	loadExtData() {
		// Load scripts:
		chrome.runtime.sendMessage(
			{ type: "background-get-user-scripts" },
			function (response) {
				// response will be an array of script objects
				this.userScripts = response;
			}.bind(this)
		);

		// Load config:
		chrome.runtime.sendMessage(
			{ type: "background-get-configuration" },
			function (response) {
				// response will be an object with properties
				this.extConfig = response;

				// Dispatch an event to notify the extension that the config has been loaded.
				document.dispatchEvent(
					new CustomEvent("extensionApplyConfig", {
						detail: {
							data: this.extConfig,
						},
					})
				);
			}.bind(this)
		);
	}

	resetState() {
		this.target = '';
		this.weaponItemName = '';
		this.shieldItemName = '';
		this.recoveringWeapon = false;
		this.shouldKill = false;
		this.shouldKillParse = '';
		this.customKillCommand = '';
		this.customKillCommandParse = '';
		this.attemptingKill = false;
		this.runRepeat = false;
		this.repeatCommand = '';
		this.runRepeatWithDelay = false;
		this.repeatWithDelayCommand = '';
		this.commandList = [];
		this.addAttack = false;
		this.stance = '';
		this.entangledCommand = '';
		this.commandOverride = '';
		this.currentCmdIndex = 0;
		this.currentMoveNextWhen = null;
		this.moveNextNow = false;
		this.currentScriptType = '';
		this.currentScriptName = '';
		this.currentScript = null;
		this.scriptPaused = false;
	}
}
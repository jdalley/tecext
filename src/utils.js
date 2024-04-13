/**
 * Send a coloured message to the console (yellow background, dark red text)
 * @param {string} message The message to send to the console
 * @param {boolean} shouldColor Should output be coloured? Defaults to true
 */
export function consoleLog(message, shouldColor = true) {
	console.log(
		`%c${message}`,
		shouldColor ? "color: darkred; background: yellow;" : ""
	);
}

/**
 * Remove indent from template strings, borrowed from:
 * https://gist.github.com/zenparsing/5dffde82d9acef19e43c
 * @param {string} callSite
 * @param  {...any} args
 * @returns String without indentation
 */
export function dedent(callSite, ...args) {
	function format(str) {
		let size = -1;
		return str.replace(/\n(\s+)/g, (m, m1) => {
			if (size < 0) size = m1.replace(/\t/g, "    ").length;

			return "\n" + m1.slice(Math.min(m1.length, size));
		});
	}

	if (typeof callSite === "string") {
		return format(callSite);
	}

	if (typeof callSite === "function") {
		return (...args) => format(callSite(...args));
	}

	let output = callSite
		.slice(0, args.length + 1)
		.map((text, i) => (i === 0 ? "" : args[i - 1]) + text)
		.join("");

	return format(output);
}

/**
 * Tests whether a variable is a positive number.
 * @param {*} value
 * @returns Boolean indicating paramter is a positive number.
 */
export function isPositiveNumeric(value) {
	return /^\d+$/.test(value);
}


/**
 * Converts a string to a boolean value.
 * @param {string} The string to convert to a boolean
 * @returns 
 */
export function stringToBoolean(string) {
	switch (string.toLowerCase().trim()) {
		case "true":
		case "yes":
		case "1":
			return true;
		case "false":
		case "no":
		case "0":
		case null:
			return false;
		default:
			return Boolean(string);
	}
}
import { MD5 } from "crypto-js";

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
 * Remove leading spaces from each line of a string, while preserving layout.
 * @param {string} str The string to dedent
 * @returns The dedented string
 */
export function dedentPreserveLayout(str) {
	// Split the input into lines
	const lines = str.split('\n');
	// Find the first non-empty line
	const firstNonEmptyLine = lines.find(line => line.trim() !== '');
	// Find the number of leading spaces on the first non-empty line
	const leadingSpaces = firstNonEmptyLine.match(/^(\s*)/)[0].length;
	// Remove the leading spaces from each line and align the explanations
	const dedentedLines = lines.map(line => {
		const trimmedLine = line.slice(leadingSpaces);
		// Replace all tab characters with spaces
		const noTabLine = trimmedLine.replace(/\t/g, ' ');
		// Split the line into a command and an explanation
		const [command, ...explanation] = noTabLine.split(':');
		// If there's an explanation, pad the command to a fixed length
		if (explanation.length > 0) {
				return command.padEnd(30) + ':' + explanation.join(':');
		}
		// If there's no explanation, return the command as is
		return command;
	});
	// Join the lines back together
	return dedentedLines.join('\n');
}

/**
 * Remove leading spaces from each line of a string.
 * @param {string} str The string to dedent
 * @returns The dedented string
 */
export function dedent(str) {
	// Split the input into lines
	const lines = str.split('\n');

	// Remove the leading spaces from each line
	const dedentedLines = lines.map(line => line.trimStart());

	// Join the lines back together
	return dedentedLines.join('\n');
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
 * @param {string} s The string to convert to a boolean
 * @returns 
 */
export function stringToBoolean(s) {
	switch (s.toLowerCase().trim()) {
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
			return Boolean(s);
	}
}

/**
 * Get a cookie by name.
 * @param {string} name The name of the cookie to retrieve
 * @returns The cookie value
 */
export function getCookieByName(name) {
	const cookies = document.cookie.split("; ");
	const cookie = cookies.find((cookie) => cookie.startsWith(name));
	return cookie ? cookie.split("=")[1] : null;
}

/**
 * Get the calculated authentication hash from the user and pass cookies in document.cookie.
 * @returns The authentication hash
 */
export function getAuthHash() {
	const username = getCookieByName("user");
	const passhash = getCookieByName("pass");
	const hash = MD5(`${username}${passhash}NONE`).toString();
	return hash;
}

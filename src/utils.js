/**
 * Tests whether a variable is a positive number.
 * @param {*} value
 * @returns Boolean indicating paramter is a positive number.
 */
export function isPositiveNumeric(value) {
	return /^\d+$/.test(value);
}
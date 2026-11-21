// Ids the admin makes: `<kind>-<time><random>`, sortable by creation time. Rows imported from the old
// admin keep their old ids.
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function newId(kind: string, now = Date.now()): string {
	let time = "";
	let value = now;
	for (let i = 0; i < 9; i++) {
		time = ALPHABET[value % 32] + time;
		value = Math.floor(value / 32);
	}
	const bytes = crypto.getRandomValues(new Uint8Array(12));
	let random = "";
	for (const byte of bytes) random += ALPHABET[byte % 32];
	return `${kind}-${time}${random}`;
}

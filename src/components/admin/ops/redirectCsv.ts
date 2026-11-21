// Reads a list of redirects pasted or loaded from a file: one per line, "old,new" or "old,new,301" (comma, semicolon or tab between
// the parts). Only the browser reads the file; the server gets JSON rows and checks every one.
export type ParsedRow = { from: string; to: string; code?: string };

export type ParsedList = { rows: ParsedRow[]; skippedHeader: boolean };

/** Splits one line at the first separators; a part may be wrapped in double quotes. */
function parts(line: string): string[] {
	const out: string[] = [];
	let current = "";
	let quoted = false;
	for (const char of line) {
		if (char === '"') quoted = !quoted;
		else if (!quoted && (char === "," || char === ";" || char === "\t")) {
			out.push(current.trim());
			current = "";
		} else current += char;
	}
	out.push(current.trim());
	return out;
}

export function parseRedirectList(text: string): ParsedList {
	const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
	let skippedHeader = false;
	const rows: ParsedRow[] = [];
	lines.forEach((line, index) => {
		const [from = "", to = "", code = ""] = parts(line);
		// A first line that names the columns instead of holding an address.
		if (index === 0 && !from.startsWith("/") && /^(from|old|cu|cũ|nguon|nguồn|duong dan cu|đường dẫn cũ)/i.test(from)) {
			skippedHeader = true;
			return;
		}
		rows.push(code ? { from, to, code } : { from, to });
	});
	return { rows, skippedHeader };
}

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Every picture of the site and the admin is stored only on Cloudflare (R2 bucket tlhp-media, read through /anh-goc/<bucket>/<path>).
// This guard fails when code under src/ or public/ names a Backblaze B2, WordPress (admin. / old.) or other outside image host again.
// New pictures in code are written as /anh-goc/… paths (or /brand/… and /images/… files bundled with the Worker).
const ROOT = join(__dirname, "..", "..");
const SCAN = ["src", "public"];
const TEXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".sass", ".html", ".svg", ".md", ".txt", ".xml", ""]);

const HOSTS: { name: string; pattern: RegExp }[] = [
	{ name: "Backblaze B2", pattern: /backblazeb2\.com/i },
	{ name: "B2 behind congngheviet", pattern: /congngheviet\.com\.vn/i },
	{ name: "WordPress uploads", pattern: /\/wp-content\//i },
	{ name: "WordPress host admin.", pattern: /admin\.tunglamhoaphuc\.com/i },
	{ name: "WordPress host old.", pattern: /old\.tunglamhoaphuc\.com/i },
	{ name: "YouTube thumbnails", pattern: /ytimg\.com/i },
	{ name: "Facebook CDN", pattern: /fbcdn\.net/i },
];

// The only files allowed to name them, and why. Each is part of the reading layer that serves or maps the OLD addresses until the
// migration is observed to be finished (docs/van-hanh/kiem-ke-anh-23-11-2026.md, steps 6 and 7); remove the entries as the code goes.
const ALLOWED: Record<string, string> = {
	"src/libs/content/media.ts": "maps the old B2 / WordPress addresses to /anh-goc/ and names the fallback origins (step 7 removes the origins)",
	"src/app/cdn-cgi/image/[...rest]/route.ts": "the fallback redirect to the WordPress host, with its log line (step 7)",
	"src/libs/content/sources/b2.ts": "reads the JSON data files from B2 when CONTENT_SOURCE=b2; no pictures",
	"src/libs/content/schedule.ts": "a warning about a calendar picture left on another B2 bucket; draws nothing",
};

function* files(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* files(path);
		else if (TEXT.has(extname(entry.name).toLowerCase()) && statSync(path).size < 3_000_000) yield path;
	}
}

const posix = (path: string) => relative(ROOT, path).split(sep).join("/");

describe("no outside image hosts in the code that ships", () => {
	const found: { file: string; line: number; host: string; text: string }[] = [];
	for (const folder of SCAN) {
		for (const path of files(join(ROOT, folder))) {
			const lines = readFileSync(path, "utf8").split(/\r?\n/);
			lines.forEach((text, index) => {
				for (const { name, pattern } of HOSTS) if (pattern.test(text)) found.push({ file: posix(path), line: index + 1, host: name, text: text.trim().slice(0, 120) });
			});
		}
	}

	it("names no B2, WordPress or other outside image host outside the reading layer's allow-list", () => {
		const stray = found.filter((hit) => !(hit.file in ALLOWED));
		expect(stray.map((hit) => `${hit.file}:${hit.line} [${hit.host}] ${hit.text}`)).toEqual([]);
	});

	it("keeps the allow-list honest: every entry still names a host, and exists", () => {
		const used = new Set(found.map((hit) => hit.file));
		for (const file of Object.keys(ALLOWED)) {
			expect(statSync(join(ROOT, file)).isFile(), file).toBe(true);
			expect(used.has(file), `${file} no longer names an outside host: remove it from ALLOWED`).toBe(true);
		}
	});
});

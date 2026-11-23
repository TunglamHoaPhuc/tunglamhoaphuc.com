// next/image sends a source to /_next/image, which fetches it from this same Worker; for a /anh-goc/ source (a route of the Worker itself)
// that fetch fails with 400 "The requested resource isn't a valid image" (seen live on 689 pages on 23/11/2026). So every <Image> whose
// source can be a /anh-goc/ picture must be `unoptimized` and take its URL from fitImage()/getImageUrl(); only static files of public/
// (literal '/images/...' sources) may go through the optimizer.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(path) : /\.tsx$/.test(name) ? [path] : [];
	});
}

test("every next/image <Image> is unoptimized unless its source is a literal static /images/ file", () => {
	const bad: string[] = [];
	for (const file of files("src")) {
		const text = readFileSync(file, "utf8");
		if (!/from ['"]next\/image['"]/.test(text)) continue;
		for (const match of text.matchAll(/<Image\b[\s\S]*?\/>/g)) {
			const tag = match[0];
			if (/\bunoptimized\b/.test(tag)) continue;
			if (/src=["']\/images\//.test(tag)) continue;
			bad.push(`${file}: ${tag.replace(/\s+/g, " ").slice(0, 100)}`);
		}
	}
	assert.deepEqual(bad, []);
});

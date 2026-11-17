// npm run check:urls -- --base=https://v2.tunglamhoaphuc.com [--write=docs/van-hanh/url-cong-khai.txt]
//
// T22: every public URL the data gives (the sitemap is made from the data: posts, teachings,
// topics, areas, statues and the fixed pages) must answer 200 on the copy about to go live.
// Exits 1 with the failing addresses when one does not. With --write the list is saved, so the
// repository holds what "every public page" meant on the day of the switch.
import { writeFileSync } from "node:fs";

const args = new Map(
	process.argv.slice(2).map((arg) => {
		const [key, ...rest] = arg.replace(/^--/, "").split("=");
		return [key, rest.join("=")] as const;
	}),
);
const base = (args.get("base") || "http://localhost:4175").replace(/\/$/, "");
const out = args.get("write");
const AT_ONCE = Number(args.get("at-once") || 4);
const RETRIES = 2;

type Result = { path: string; status: number; note?: string };

async function get(url: string): Promise<{ status: number; text: string }> {
	let last = { status: 0, text: "" };
	for (let attempt = 0; attempt <= RETRIES; attempt++) {
		try {
			const response = await fetch(url, { redirect: "manual", headers: { "user-agent": "tlhp-check-urls" } });
			last = { status: response.status, text: response.status === 200 ? await response.text() : "" };
			// A busy Worker answers 5xx for a moment; anything else is the real answer.
			if (response.status < 500) return last;
		} catch {
			last = { status: 0, text: "" };
		}
		await new Promise((done) => setTimeout(done, 1000 * (attempt + 1)));
	}
	return last;
}

async function main() {
	const sitemap = await get(`${base}/sitemap.xml`);
	if (sitemap.status !== 200) throw new Error(`sitemap.xml answered ${sitemap.status} on ${base}`);
	const paths = [...sitemap.text.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((match) => match[1]);
	if (paths.length < 100) throw new Error(`only ${paths.length} addresses in the sitemap: the data did not load`);
	console.log(`${paths.length} public addresses on ${base}, ${AT_ONCE} at a time`);

	const results: Result[] = [];
	let next = 0;
	async function worker() {
		while (next < paths.length) {
			const path = paths[next++];
			const { status, text } = await get(base + path);
			const note = status === 200 && !/<h1[\s>]/.test(text) ? "no h1" : undefined;
			results.push({ path, status, note });
			if (results.length % 100 === 0) console.log(`  ${results.length}/${paths.length}`);
		}
	}
	await Promise.all(Array.from({ length: AT_ONCE }, worker));

	const bad = results.filter((result) => result.status !== 200 || result.note);
	const ok = results.length - bad.length;
	console.log(`${ok}/${results.length} answered 200 with a heading`);
	for (const result of bad) console.log(`  ${result.status || "no answer"}  ${result.path}${result.note ? `  (${result.note})` : ""}`);

	if (out) {
		const sorted = [...results].sort((a, b) => a.path.localeCompare(b.path));
		writeFileSync(out, `# Địa chỉ công khai lấy từ dữ liệu, kiểm bởi npm run check:urls (${new Date().toISOString().slice(0, 10)}, ${base})\n# ${ok}/${results.length} trả 200\n${sorted.map((r) => r.path).join("\n")}\n`);
		console.log(`saved ${out}`);
	}
	process.exit(bad.length ? 1 : 0);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});

// npm run media:copy -- [--limit=50] [--verify] [--at-once=10] [--dry-run] [--out=data/snapshot/media-copy]
//
// T42b: copies every picture of the temple from B2 (two buckets), WordPress and the old site's
// own /images/ folder into the PRIVATE R2 bucket `tlhp-media`, keeping the `<bucket>/<key>`
// key that mediaUrl() already uses, so the address of a picture never changes.
//
// Keys in R2:
//   <bucket>/<key>               B2 files (s2-cnv03/…, media-tunglamhoaphuc/…)
//   wordpress/<path>             WordPress files: the path after /wp-content/uploads/
//                                (anything else under /wp-content/ keeps "wp-content/…")
//   site/<path>                  files of the old site's own public/ folder (quotes of the calendar)
//
// Re-runnable: the bucket is listed first and keys already there are skipped. Read-only on B2
// and WordPress. EXIF (cameras write GPS) and other metadata are removed; pictures longer than
// 2560 px are scaled down to 2560 px. Format stays the same. Writes through the `cf` CLI with
// the `tlhp` profile, so no key is ever in the repository or in a log.
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);

const args = new Map(
	process.argv.slice(2).map((arg) => {
		const [key, ...rest] = arg.replace(/^--/, "").split("=");
		return [key, rest.join("=") || "true"] as const;
	}),
);
const BUCKET = args.get("bucket") ?? "tlhp-media";
const PROFILE = args.get("profile") ?? "tlhp";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "b91a395bd9b7ab86ef4cba41d1d828ae";
const AT_ONCE = Number(args.get("at-once") ?? 14);
const LIMIT = Number(args.get("limit") ?? 0); // per group; 0 = everything
const DRY_RUN = args.has("dry-run");
const OUT = args.get("out") ?? "data/snapshot/media-copy";
const SNAPSHOT_DIR = "data/snapshot";
const MAX_SIDE = 2560;
const OLD_SITE = "https://www.tunglamhoaphuc.com";
const WORDPRESS = "https://admin.tunglamhoaphuc.com";
const TIMEOUT_MS = 60_000;

type Group = "b2:s2-cnv03" | "b2:media-tunglamhoaphuc" | "b2:other" | "wordpress" | "site";
type Item = { key: string; source: string; group: Group };
type Failure = { key: string; source: string; kind: "404" | "http" | "network" | "image" | "upload"; detail: string };

const CONTENT_TYPES: Record<string, string> = {
	".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".jfif": "image/jpeg", ".png": "image/png", ".gif": "image/gif",
	".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".mp4": "video/mp4",
	".pdf": "application/pdf",
};

// ---- the list of pictures -------------------------------------------------------------

function classify(raw: string): Item | null {
	let url: URL;
	try {
		url = new URL(raw.replace(/&amp;/g, "&"));
	} catch {
		return null;
	}
	const path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
	const b2s3 = /^([a-z0-9-]+)\.s3\.us-east-005\.backblazeb2\.com$/.exec(url.host);
	if (b2s3 && path) return b2Item(b2s3[1], path);
	if (/^(b1\.congngheviet\.com\.vn|f\d{3}\.backblazeb2\.com)$/.test(url.host)) {
		const m = /^file\/([^/]+)\/(.+)$/.exec(path);
		return m ? b2Item(m[1], m[2]) : null;
	}
	if (/^(admin\.|www\.)?tunglamhoaphuc\.com$/.test(url.host) && path.startsWith("wp-content/")) {
		const rest = path.replace(/^wp-content\/uploads\//, "");
		const key = rest === path ? path : rest;
		return { key: `wordpress/${key}`, source: `${WORDPRESS}/${path.split("/").map(encodeURIComponent).join("/")}`, group: "wordpress" };
	}
	return null;
}

function b2Item(bucket: string, key: string): Item {
	const group: Group = bucket === "s2-cnv03" || bucket === "media-tunglamhoaphuc" ? `b2:${bucket}` : "b2:other";
	return { key: `${bucket}/${key}`, source: `https://${bucket}.s3.us-east-005.backblazeb2.com/${key.split("/").map(encodeURIComponent).join("/")}`, group };
}

function gather(): Item[] {
	const items = new Map<string, Item>();
	for (const file of readdirSync(SNAPSHOT_DIR).filter((name) => name.endsWith(".json"))) {
		const text = readFileSync(join(SNAPSHOT_DIR, file), "utf8");
		for (const match of text.matchAll(/https?:\/\/[^\s"'()<>\\]+|\/\/[a-z0-9.-]+\/[^\s"'()<>\\]+/g)) {
			const item = classify(match[0].startsWith("//") ? `https:${match[0]}` : match[0]);
			if (item) items.set(item.key, item);
		}
		for (const match of text.matchAll(/"(\/images\/[^"\\]+\.(?:png|jpe?g|webp|gif|avif|svg))"/gi)) {
			const path = match[1].slice(1);
			items.set(`site/${path}`, { key: `site/${path}`, source: `${OLD_SITE}/${path.split("/").map(encodeURIComponent).join("/")}`, group: "site" });
		}
	}
	return [...items.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ---- R2 through the cf CLI ------------------------------------------------------------

const cfEnv = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };
// The `cf` package of this repo, run by node itself: no shell, so a key with spaces, `&` or `%`
// reaches the CLI untouched.
const CF_BIN = join(process.cwd(), "node_modules", "cf", "bin", "cf");

async function cf(argv: string[]): Promise<string> {
	const { stdout } = await run(process.execPath, [CF_BIN, ...argv, "--profile", PROFILE], { env: cfEnv, maxBuffer: 256 * 1024 * 1024 });
	return stdout;
}

type Listed = { key: string; size: number };

async function listBucket(): Promise<Map<string, number>> {
	const all = new Map<string, number>();
	let after = "";
	for (;;) {
		const argv = ["r2", "objects", "list", "--bucket-name", BUCKET, "--per-page", "1000"];
		if (after) argv.push("--start-after", after);
		const page = JSON.parse(await cf(argv)) as Listed[];
		if (!page.length) break;
		for (const object of page) all.set(object.key, object.size);
		const last = page[page.length - 1].key;
		if (last === after) break;
		after = last;
	}
	return all;
}

// ---- one picture ----------------------------------------------------------------------

async function download(source: string): Promise<{ buffer: Buffer; contentType: string } | { fail: Omit<Failure, "key" | "source"> }> {
	let last: Omit<Failure, "key" | "source"> = { kind: "network", detail: "" };
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const response = await fetch(source, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "tlhp-media-copy" } });
			if (response.status === 404 || response.status === 410) return { fail: { kind: "404", detail: String(response.status) } };
			if (!response.ok) {
				last = { kind: "http", detail: String(response.status) };
				continue;
			}
			return { buffer: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "" };
		} catch (error) {
			last = { kind: "network", detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
		}
	}
	return { fail: last };
}

/** The bytes to store: metadata removed and size capped, or the original bytes when there is nothing to remove. */
async function clean(buffer: Buffer, type: string): Promise<{ buffer: Buffer; changed: boolean }> {
	if (!/^image\/(jpeg|png|webp|avif|tiff)$/.test(type)) return { buffer, changed: false };
	const image = sharp(buffer, { failOn: "none", limitInputPixels: false });
	const meta = await image.metadata();
	if ((meta.pages ?? 1) > 1) return { buffer, changed: false }; // animated: keep as is
	const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
	const hasMeta = !!(meta.exif || meta.xmp || meta.iptc || meta.tifftagPhotoshop || (meta.orientation ?? 1) > 1);
	if (!hasMeta && longest <= MAX_SIDE) return { buffer, changed: false };
	let pipeline = sharp(buffer, { failOn: "none", limitInputPixels: false }).rotate(); // bake the orientation in, then no EXIF
	if (longest > MAX_SIDE) pipeline = pipeline.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
	pipeline = pipeline.keepIccProfile();
	if (type === "image/jpeg") pipeline = pipeline.jpeg({ quality: 88, mozjpeg: true });
	else if (type === "image/png") pipeline = pipeline.png({ compressionLevel: 9 });
	else if (type === "image/webp") pipeline = pipeline.webp({ quality: 88 });
	else if (type === "image/avif") pipeline = pipeline.avif({ quality: 70 });
	const out = await pipeline.toBuffer();
	// Never store a re-encode that came out bigger unless it was needed to cap the size.
	return longest <= MAX_SIDE && out.length >= buffer.length && !meta.exif ? { buffer, changed: false } : { buffer: out, changed: true };
}

function contentTypeOf(key: string, served: string): string {
	const byExtension = CONTENT_TYPES[extname(key).toLowerCase()];
	const clean = served.split(";")[0].trim().toLowerCase();
	if (byExtension && (!clean || clean === "application/octet-stream" || clean.startsWith("text/"))) return byExtension;
	return clean || byExtension || "application/octet-stream";
}

// ---- main -----------------------------------------------------------------------------

/** --verify: compare the bucket with the list, sum the size, and look for EXIF in a sample of pictures. */
async function verify() {
	mkdirSync(OUT, { recursive: true });
	const all = gather();
	const present = await listBucket();
	let report: { failures?: Failure[] } = {};
	try {
		report = JSON.parse(readFileSync(join(OUT, "bao-cao-loi.json"), "utf8"));
	} catch {
		// no report yet: every missing key counts as unexplained
	}
	const failed = new Set((report.failures ?? []).map((failure) => failure.key));
	const wanted = new Set(all.map((item) => item.key));
	const missing = all.filter((item) => !present.has(item.key) && !failed.has(item.key));
	const extra = [...present.keys()].filter((key) => !wanted.has(key));
	let bytes = 0;
	for (const size of present.values()) bytes += size;
	const images = [...present.keys()].filter((key) => /\.(jpe?g|jfif|png|webp|avif)$/i.test(key));
	const sample = images.sort(() => Math.random() - 0.5).slice(0, Number(args.get("sample") ?? 50));
	const withExif: string[] = [];
	const tooBig: string[] = [];
	for (const key of sample) {
		const { stdout } = await run(process.execPath, [CF_BIN, "r2", "objects", "get", key, "--bucket-name", BUCKET, "--profile", PROFILE], {
			env: cfEnv, encoding: "buffer", maxBuffer: 256 * 1024 * 1024,
		});
		const meta = await sharp(stdout, { failOn: "none", limitInputPixels: false }).metadata();
		if (meta.exif || meta.xmp || meta.iptc) withExif.push(key);
		if (Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_SIDE) tooBig.push(key);
	}
	const summary = {
		listed: all.length, inBucket: present.size, failedKnown: failed.size, missingUnexplained: missing.length, extraKeys: extra.length,
		gigabytes: Number((bytes / 1e9).toFixed(3)), sampled: sample.length, sampleWithExif: withExif.length, sampleTooBig: tooBig.length,
	};
	writeFileSync(join(OUT, "kiem-tra.json"), JSON.stringify({ ...summary, missing: missing.map((m) => m.key), extra, withExif, tooBig }, null, "	"));
	console.log(summary);
}

async function main() {
	if (args.has("verify")) return verify();
	const started = Date.now();
	mkdirSync(OUT, { recursive: true });
	const all = gather();
	const groups = new Map<Group, Item[]>();
	for (const item of all) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
	const wanted = LIMIT ? [...groups.values()].flatMap((list) => list.slice(0, LIMIT)) : all;
	console.log("Danh sách:", [...groups].map(([group, list]) => `${group} ${list.length}`).join(" · "), `| lần này: ${wanted.length}`);
	if (DRY_RUN) return;

	const present = await listBucket();
	console.log(`Bucket ${BUCKET} đã có ${present.size} khóa`);
	const todo = wanted.filter((item) => !present.has(item.key));
	console.log(`Cần chép: ${todo.length} (bỏ qua ${wanted.length - todo.length} khóa đã có)`);

	const tmp = mkdtempSync(join(tmpdir(), "media-copy-"));
	const failures: Failure[] = [];
	const stats = { copied: 0, bytesIn: 0, bytesOut: 0, stripped: 0 };
	let next = 0;
	let done = 0;

	async function one(item: Item, slot: number) {
		const fetched = await download(item.source);
		if ("fail" in fetched) return void failures.push({ key: item.key, source: item.source, ...fetched.fail });
		const type = contentTypeOf(item.key, fetched.contentType);
		let body: Buffer;
		try {
			const result = await clean(fetched.buffer, type);
			body = result.buffer;
			if (result.changed) stats.stripped++;
		} catch (error) {
			return void failures.push({ key: item.key, source: item.source, kind: "image", detail: error instanceof Error ? error.message : String(error) });
		}
		const file = join(tmp, `${slot}${extname(item.key).toLowerCase()}`);
		writeFileSync(file, body);
		for (let attempt = 0; ; attempt++) {
			try {
				await cf(["r2", "objects", "put", item.key, "--bucket-name", BUCKET, "--file", file, "--content-type", type]);
				break;
			} catch (error) {
				if (attempt >= 3) {
					const err = error as { stderr?: string; stdout?: string; message?: string };
					const detail = (err.stderr || err.stdout || err.message || String(error)).replace(/\s+/g, " ").slice(0, 300);
					return void failures.push({ key: item.key, source: item.source, kind: "upload", detail });
				}
				// The API pushes back when asked too fast: wait a little longer each time.
				await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
			}
		}
		stats.copied++;
		stats.bytesIn += fetched.buffer.length;
		stats.bytesOut += body.length;
	}

	async function worker(slot: number) {
		while (next < todo.length) {
			const item = todo[next++];
			await one(item, slot);
			if (++done % 100 === 0 || done === todo.length) {
				const minutes = (Date.now() - started) / 60_000;
				console.log(`${done}/${todo.length} · chép ${stats.copied} · lỗi ${failures.length} · ${(stats.bytesOut / 1e9).toFixed(2)} GB · ${minutes.toFixed(1)} phút`);
			}
		}
	}
	await Promise.all(Array.from({ length: AT_ONCE }, (_, slot) => worker(slot)));
	rmSync(tmp, { recursive: true, force: true });

	const byKind: Record<string, number> = {};
	for (const failure of failures) byKind[failure.kind] = (byKind[failure.kind] ?? 0) + 1;
	const report = { finishedAt: new Date().toISOString(), listed: all.length, attempted: todo.length, ...stats, failedByKind: byKind, failures };
	writeFileSync(join(OUT, "bao-cao-loi.json"), JSON.stringify(report, null, "\t"));
	console.log(`Xong sau ${((Date.now() - started) / 60_000).toFixed(1)} phút: chép ${stats.copied}, đã gỡ metadata/thu nhỏ ${stats.stripped}, lỗi ${failures.length}`, byKind);
	console.log(`Dung lượng: tải về ${(stats.bytesIn / 1e9).toFixed(2)} GB, ghi vào R2 ${(stats.bytesOut / 1e9).toFixed(2)} GB. Báo cáo: ${join(OUT, "bao-cao-loi.json")}`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});

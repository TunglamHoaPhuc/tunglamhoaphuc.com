#!/usr/bin/env node
// Image variants of the temple's pictures (23/11/2026; docs/van-hanh/anh.md, docs/toi-uu-anh-23-11-2026.md of V3, sections 4-6).
//
//   node scripts/media-variants.mjs --dry-run --only media-tunglamhoaphuc/tunglamhoaphuc2/ --limit 20
//   node scripts/media-variants.mjs --keys-file keys.txt --manifest out/first-batch.jsonl
//   node scripts/media-variants.mjs --local-dir <folder of originals> --dry-run            (no cloud at all)
//   node scripts/media-variants.mjs --verify --sample 30 --only wordpress/2026/
//
// For every picture in the bucket (jpg, jpeg, jfif, png, webp, static gif) this writes next to it, as new R2 objects:
//   <original key>@<width>.avif   <original key>@<width>.webp      width = 160, 360, 640, 960, 1280, 1920 (those below the original's width)
//   <original key>@max.avif       <original key>@max.webp          the original's width, at most 2560
// The route /anh-goc/ (src/libs/content/mediaRoute.ts) serves them; the originals are never touched.
//
// Rules (the spec of section 5):
//  - Pixels: sharp(...).rotate().toColourspace("srgb"), all metadata dropped; Lanczos3, never enlarged; alpha is kept (and dropped when fully opaque).
//  - Quality: the first level whose SSIM-Y (Gauss 11x11 on luma, against the same-size original) is >= 0.96 and whose p5 (the worst 5% of the
//    local SSIM map) is >= 0.85. AVIF effort 4 starts at q70, then 80, 90; WebP effort 5 + smartSubsample starts at q85, then 90, 95. Only when a level
//    passes but is not smaller than the original-size rule below does it go DOWN, to q60 (AVIF) / q80 (WebP), never lower.
//  - Original-size rule: a variant is written only when it is smaller than the original shrunk to that width in the original's own format
//    (jpeg q85 mozjpeg, png level 9, webp q85; for a width equal to the original's, the original file itself). A format that fails the gate or the
//    rule gets no file at that width (the route then falls back: other format, larger width, original).
//  - Never overwrites or deletes anything; only writes keys that contain "@"; an original whose own key contains "@" is skipped.
//  - Idempotent: a variant that exists and is not older than its original (or whose custom metadata src-etag equals the original's etag) is skipped.
//
// Where the pictures live (--backend, default: s3 when R2_S3_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are set, else cf):
//   cf     the `cf` CLI of this repo (node_modules/cf), profile `tlhp`: about 2 s per call, so 12 pictures at once. The CLI cannot set custom
//          metadata, so freshness is judged by last-modified time.
//   s3     R2's S3-compatible endpoint through @aws-sdk/client-s3 (not a dependency of this repo: `npm i --no-save @aws-sdk/client-s3` first).
//          Writes the custom metadata src, src-etag, w, h, q, ssim, gen.
//   --local-dir <dir>   originals are the files under <dir> (key = relative path), variants go to --out-dir (default <dir>-variants).
// Secrets are only ever read from the environment, never printed.
//
// Options:
//   --dry-run               do everything (read, resize, encode, score) except writing; prints what would be written
//   --only <prefix>         only keys that start with it (repeat or comma-separate for several); without it the whole bucket is listed
//   --keys-file <file>      only the keys listed in the file (one per line, or a JSON array)
//   --missing               only pictures that have no variant yet (no download at all for the others)
//   --limit <n>             at most n pictures (in key order)
//   --concurrency <n>       pictures in flight, default 12 (cf) / 32 (s3) / 4 (local)
//   --workers <n>           threads for resizing, encoding and scoring, default min(4, cpus - 2); 0 = in this thread
//   --manifest <file>       one JSON line per picture and per variant: key, W, H, step, format, bytes, q, ssim, p5, status (for loading width/height into D1)
//   --bucket <name>         default tlhp-media          --profile <name>   `cf` profile, default tlhp
//   --verify [--sample <n>] re-read n variants (default 20) with their originals and recompute SSIM; exit code 1 when one is below the gate
//   --quiet                 only the summary

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import sharp from "sharp";

// ---- the spec -------------------------------------------------------------------------------------------------------------------------------

const LADDER = [160, 360, 640, 960, 1280, 1920]; // src/libs/content/media.ts: VARIANT_WIDTHS (a test keeps both equal)
const MAX_WIDTH = 2560;
const GATE = { ssim: 0.96, p5: 0.85 };
const PROFILES = {
	avif: { up: [70, 80, 90], down: [60] },
	webp: { up: [85, 90, 95], down: [80] },
};
const FORMATS = ["avif", "webp"];
const SOURCE = /\.(jpe?g|jfif|png|webp|gif)$/i;
const VARIANT_KEY = /@(\d+|max)\.(avif|webp)$/;
const GENERATOR = "media-variants/1";
const TYPE = { avif: "image/avif", webp: "image/webp" };
const SHARP = { limitInputPixels: false, failOn: "none" };

// ---- SSIM (Wang et al. 2004: Gauss window 11x11, sigma 1.5, K1 0.01, K2 0.03) ---------------------------------------------------------------

const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;
const KERNEL = (() => {
	const k = [];
	for (let i = -5; i <= 5; i++) k.push(Math.exp(-(i * i) / (2 * 1.5 * 1.5)));
	const sum = k.reduce((a, b) => a + b, 0);
	return Float32Array.from(k.map((v) => v / sum));
})();

/** Luma of interleaved 8-bit pixels; transparent pixels are laid on white, as a browser shows them on this site's light pages. */
function luma(data, w, h, channels) {
	const out = new Float32Array(w * h);
	for (let i = 0, j = 0; i < out.length; i++, j += channels) {
		let r;
		let g;
		let b;
		if (channels >= 3) [r, g, b] = [data[j], data[j + 1], data[j + 2]];
		else r = g = b = data[j];
		const alpha = channels === 4 ? data[j + 3] / 255 : channels === 2 ? data[j + 1] / 255 : 1;
		if (alpha < 1) {
			r = r * alpha + 255 * (1 - alpha);
			g = g * alpha + 255 * (1 - alpha);
			b = b * alpha + 255 * (1 - alpha);
		}
		out[i] = 0.299 * r + 0.587 * g + 0.114 * b;
	}
	return out;
}

// Separable convolution, "valid" mode: (w-10) x (h-10).
function gauss(src, w, h) {
	const ow = w - 10;
	const oh = h - 10;
	const tmp = new Float32Array(ow * h);
	for (let y = 0; y < h; y++) {
		const row = y * w;
		const trow = y * ow;
		for (let x = 0; x < ow; x++) {
			let s = 0;
			for (let k = 0; k < 11; k++) s += src[row + x + k] * KERNEL[k];
			tmp[trow + x] = s;
		}
	}
	const out = new Float32Array(ow * oh);
	for (let y = 0; y < oh; y++) {
		for (let x = 0; x < ow; x++) {
			let s = 0;
			for (let k = 0; k < 11; k++) s += tmp[(y + k) * ow + x] * KERNEL[k];
			out[y * ow + x] = s;
		}
	}
	return out;
}

/** @returns {{mean:number, p5:number}} mean SSIM and the 5th percentile of the local SSIM map (every 4th window), 1 for pictures under 12 px. */
export function ssim(a, b, w, h) {
	if (w < 12 || h < 12) return { mean: 1, p5: 1 };
	const n = w * h;
	const xx = new Float32Array(n);
	const yy = new Float32Array(n);
	const xy = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		xx[i] = a[i] * a[i];
		yy[i] = b[i] * b[i];
		xy[i] = a[i] * b[i];
	}
	const mx = gauss(a, w, h);
	const my = gauss(b, w, h);
	const sxx = gauss(xx, w, h);
	const syy = gauss(yy, w, h);
	const sxy = gauss(xy, w, h);
	const m = mx.length;
	let total = 0;
	const sample = new Float32Array(Math.ceil(m / 4));
	let count = 0;
	for (let i = 0; i < m; i++) {
		const vx = sxx[i] - mx[i] * mx[i];
		const vy = syy[i] - my[i] * my[i];
		const cv = sxy[i] - mx[i] * my[i];
		const s = ((2 * mx[i] * my[i] + C1) * (2 * cv + C2)) / ((mx[i] * mx[i] + my[i] * my[i] + C1) * (vx + vy + C2));
		total += s;
		if ((i & 3) === 0) sample[count++] = s;
	}
	const sorted = sample.subarray(0, count).sort();
	return { mean: total / m, p5: sorted[Math.min(count - 1, Math.floor(count * 0.05))] ?? 1 };
}

const decode = (input) => sharp(input, SHARP).toColourspace("srgb").raw({ depth: "uchar" }).toBuffer({ resolveWithObject: true });

// ---- one picture: all variants (runs in a worker thread) -----------------------------------------------------------------------------------

/**
 * @param {{key:string, bytes:Uint8Array, have:string[]}} job   have: "<step>.<format>" variants that exist already and are fresh
 * @returns the picture's size and, per step and format, a variant (status "ok", with data) or why there is none
 */
export async function compute(job) {
	const input = Buffer.from(job.bytes.buffer, job.bytes.byteOffset, job.bytes.byteLength);
	const have = new Set(job.have);
	let meta;
	try {
		meta = await sharp(input, SHARP).metadata();
	} catch (error) {
		return { key: job.key, skipped: `unreadable: ${String(error.message).slice(0, 80)}` };
	}
	if ((meta.pages ?? 1) > 1) return { key: job.key, skipped: "animated" };
	if (!["jpeg", "png", "webp", "gif"].includes(meta.format ?? "")) return { key: job.key, skipped: `format ${meta.format}` };

	// Decode once, upright, sRGB, 8 bits; fully opaque alpha is dropped (it only costs bytes).
	let { data, info } = await sharp(input, SHARP).rotate().toColourspace("srgb").raw({ depth: "uchar" }).toBuffer({ resolveWithObject: true });
	if (info.channels === 4) {
		let opaque = true;
		for (let i = 3; i < data.length; i += 4) {
			if (data[i] !== 255) {
				opaque = false;
				break;
			}
		}
		if (opaque) ({ data, info } = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
	}
	const W = info.width;
	const H = info.height;
	const channels = info.channels;
	const raw = { raw: { width: W, height: H, channels } };
	const result = { key: job.key, W, H, srcFormat: meta.format, alpha: channels === 4, variants: [] };

	const steps = [...LADDER.filter((width) => width < W).map((width) => ({ step: String(width), width })), { step: "max", width: Math.min(W, MAX_WIDTH) }];
	for (const { step, width } of steps) {
		const formats = FORMATS.filter((format) => !have.has(`${step}.${format}`));
		for (const format of FORMATS) if (!formats.includes(format)) result.variants.push({ step, format, status: "exists" });
		if (!formats.length) continue;

		const resized = width === W ? { data, info } : await sharp(data, raw).resize({ width, kernel: "lanczos3", withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
		const w = resized.info.width;
		const h = resized.info.height;
		const view = { raw: { width: w, height: h, channels } };
		const reference = luma(resized.data, w, h, channels);

		// The original-size rule: the original shrunk to this width, in its own format (the original itself when it is not shrunk).
		let referenceBytes;
		const sizeToBeat = async () => {
			if (referenceBytes !== undefined) return referenceBytes;
			if (width === W) return (referenceBytes = input.length);
			const base = sharp(resized.data, view);
			const encoded =
				meta.format === "jpeg"
					? await base.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
					: meta.format === "webp"
						? await base.webp({ quality: 85, effort: 4 }).toBuffer()
						: await base.png({ compressionLevel: 9 }).toBuffer();
			return (referenceBytes = encoded.length);
		};

		for (const format of formats) {
			const encode = (quality) =>
				format === "avif" ? sharp(resized.data, view).avif({ quality, effort: 4 }).toBuffer() : sharp(resized.data, view).webp({ quality, effort: 5, smartSubsample: true }).toBuffer();
			const attempt = async (quality) => {
				const out = await encode(quality);
				const back = await decode(out);
				if (back.info.width !== w || back.info.height !== h) throw new Error(`size ${back.info.width}x${back.info.height} instead of ${w}x${h}`);
				const score = ssim(reference, luma(back.data, w, h, back.info.channels), w, h);
				return { quality, out, ssim: score.mean, p5: score.p5, pass: score.mean >= GATE.ssim && score.p5 >= GATE.p5 };
			};
			try {
				const profile = PROFILES[format];
				let chosen = null;
				let best = null;
				for (const quality of profile.up) {
					const tried = await attempt(quality);
					if (!best || tried.ssim > best.ssim) best = tried;
					if (tried.pass) {
						chosen = tried;
						break;
					}
				}
				if (!chosen) {
					result.variants.push({ step, format, w, h, status: "gate", q: best.quality, ssim: best.ssim, p5: best.p5, bytes: best.out.length });
					continue;
				}
				const limit = await sizeToBeat();
				if (chosen.out.length >= limit && chosen.quality === profile.up[0]) {
					for (const quality of profile.down) {
						const tried = await attempt(quality);
						if (tried.pass && tried.out.length < limit) {
							chosen = tried;
							break;
						}
					}
				}
				if (chosen.out.length >= limit) {
					result.variants.push({ step, format, w, h, status: "bigger", q: chosen.quality, ssim: chosen.ssim, p5: chosen.p5, bytes: chosen.out.length, limit });
					continue;
				}
				const copy = new Uint8Array(chosen.out); // own buffer: it is handed to the main thread
				result.variants.push({ step, format, w, h, status: "ok", q: chosen.quality, ssim: chosen.ssim, p5: chosen.p5, bytes: copy.length, limit, data: copy });
			} catch (error) {
				result.variants.push({ step, format, w, h, status: "error", note: String(error.message).slice(0, 120) });
			}
		}
	}
	return result;
}

/** The variants of `result` in the shape a worker may post: buffers move instead of being copied. */
const transferables = (result) => (result.variants ?? []).filter((v) => v.data).map((v) => v.data.buffer);

if (!isMainThread) {
	sharp.concurrency(1);
	parentPort.on("message", async (job) => {
		try {
			const result = await compute(job);
			parentPort.postMessage({ id: job.id, result }, transferables(result));
		} catch (error) {
			parentPort.postMessage({ id: job.id, error: String(error?.stack ?? error).slice(0, 400) });
		}
	});
}

// ---- storage ---------------------------------------------------------------------------------------------------------------------------------
// An entry: { key, size, etag, modified (ms), meta, type }.

const toPosix = (p) => p.split(path.sep).join("/");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function localBackend(dir, outDir) {
	const walk = (root) => {
		const found = [];
		const visit = (folder) => {
			for (const name of fs.readdirSync(folder, { withFileTypes: true })) {
				const full = path.join(folder, name.name);
				if (name.isDirectory()) visit(full);
				else found.push(full);
			}
		};
		if (fs.existsSync(root)) visit(root);
		return found.map((file) => {
			const stat = fs.statSync(file);
			return { key: toPosix(path.relative(root, file)), size: stat.size, etag: `${stat.size}-${Math.round(stat.mtimeMs)}`, modified: stat.mtimeMs, meta: {}, type: "" };
		});
	};
	return {
		name: `local (${dir} -> ${outDir})`,
		async list(prefix) {
			return [...walk(dir), ...walk(outDir)].filter((entry) => entry.key.startsWith(prefix));
		},
		async get(key) {
			const file = path.join(VARIANT_KEY.test(key) ? outDir : dir, key);
			return fs.readFileSync(file);
		},
		async put(key, bytes) {
			const file = path.join(outDir, key);
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, bytes);
		},
	};
}

function cfBackend(bucket, profile) {
	const run = promisify(execFile);
	const here = path.dirname(fileURLToPath(import.meta.url));
	const bin = process.env.CF_BIN ?? path.join(here, "..", "node_modules", "cf", "bin", "cf");
	// The account id is no secret (media-copy.ts has it too); the token stays in the cf profile.
	const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? "b91a395bd9b7ab86ef4cba41d1d828ae" };
	// Run by node itself, without a shell: a key with spaces, & or % reaches the CLI untouched.
	const cf = async (argv, buffer = false) => {
		for (let attempt = 0; ; attempt++) {
			try {
				const { stdout } = await run(process.execPath, [bin, ...argv, "--profile", profile], { env, maxBuffer: 512 * 1024 * 1024, encoding: buffer ? "buffer" : "utf8", windowsHide: true });
				return stdout;
			} catch (error) {
				if (attempt >= 3) throw new Error(`cf ${argv.slice(0, 3).join(" ")}: ${String(error.stderr || error.message).replace(/\s+/g, " ").slice(0, 200)}`, { cause: error });
				await sleep(2000 * (attempt + 1)); // the API pushes back when asked too fast
			}
		}
	};
	return {
		name: `cf (profile ${profile}, bucket ${bucket})`,
		async list(prefix) {
			const all = [];
			let after = "";
			for (;;) {
				const argv = ["r2", "objects", "list", "--bucket-name", bucket, "--per-page", "1000"];
				if (prefix) argv.push("--prefix", prefix);
				if (after) argv.push("--start-after", after);
				const page = JSON.parse(await cf(argv));
				if (!page.length) break;
				for (const o of page) all.push({ key: o.key, size: o.size, etag: o.etag, modified: Date.parse(o.last_modified), meta: o.custom_metadata ?? {}, type: o.http_metadata?.contentType ?? "" });
				const last = page[page.length - 1].key;
				if (last === after || page.length < 1000) break;
				after = last;
			}
			return all;
		},
		async get(key) {
			return cf(["r2", "objects", "get", key, "--bucket-name", bucket], true);
		},
		async put(key, bytes, { type }) {
			const file = path.join(os.tmpdir(), `media-variants-${process.pid}-${Math.random().toString(36).slice(2)}${key.endsWith(".avif") ? ".avif" : ".webp"}`);
			fs.writeFileSync(file, bytes);
			try {
				await cf(["r2", "objects", "put", key, "--bucket-name", bucket, "--file", file, "--content-type", type]);
			} finally {
				fs.rmSync(file, { force: true });
			}
		},
	};
}

async function s3Backend(bucket) {
	let sdk;
	try {
		sdk = await import("@aws-sdk/client-s3");
	} catch {
		throw new Error("--backend s3 needs @aws-sdk/client-s3, which this repo does not have: run `npm i --no-save @aws-sdk/client-s3` or use --backend cf");
	}
	const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = sdk;
	const client = new S3Client({
		region: "auto",
		endpoint: process.env.R2_S3_ENDPOINT,
		credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
		forcePathStyle: true,
	});
	return {
		name: `s3 (${new URL(process.env.R2_S3_ENDPOINT).host}, bucket ${bucket})`,
		async list(prefix) {
			const all = [];
			let token;
			do {
				const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined, ContinuationToken: token }));
				for (const o of page.Contents ?? []) all.push({ key: o.Key, size: o.Size, etag: String(o.ETag ?? "").replace(/"/g, ""), modified: o.LastModified?.getTime() ?? 0, meta: {}, type: "" });
				token = page.IsTruncated ? page.NextContinuationToken : undefined;
			} while (token);
			return all;
		},
		async get(key) {
			const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
			return Buffer.from(await object.Body.transformToByteArray());
		},
		async put(key, bytes, { type, meta }) {
			await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: type, Metadata: meta }));
		},
	};
}

// ---- the run ---------------------------------------------------------------------------------------------------------------------------------

/** Run `task` on at most `limit` items at a time. */
async function pool(items, limit, task) {
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
			while (next < items.length) {
				const index = next++;
				await task(items[index], index);
			}
		}),
	);
}

function makeCompute(workers) {
	if (!workers) return (job) => compute(job);
	const threads = Array.from({ length: workers }, () => {
		const worker = new Worker(fileURLToPath(import.meta.url));
		return { worker, busy: false, dead: false };
	});
	const waiting = [];
	const pending = new Map();
	let id = 0;
	const dispatch = () => {
		for (const thread of threads) {
			if (thread.busy || thread.dead || !waiting.length) continue;
			const { job, resolve, reject } = waiting.shift();
			const jobId = ++id;
			thread.busy = true;
			pending.set(jobId, { resolve, reject, thread });
			thread.worker.postMessage({ ...job, id: jobId }, [job.bytes.buffer]);
		}
	};
	for (const thread of threads) {
		thread.worker.on("message", ({ id: jobId, result, error }) => {
			const entry = pending.get(jobId);
			pending.delete(jobId);
			thread.busy = false;
			if (error) entry.reject(new Error(error));
			else entry.resolve(result);
			dispatch();
		});
		thread.worker.on("error", (error) => {
			// A thread that died takes its picture down with it (that one fails); the others carry on.
			thread.dead = true;
			for (const [jobId, entry] of [...pending]) {
				if (entry.thread !== thread) continue;
				pending.delete(jobId);
				entry.reject(error);
			}
			if (threads.every((t) => t.dead)) for (const { reject } of waiting.splice(0)) reject(error);
		});
	}
	const run = (job) => new Promise((resolve, reject) => (waiting.push({ job: { ...job, bytes: new Uint8Array(job.bytes) }, resolve, reject }), dispatch()));
	run.close = () => Promise.all(threads.map((t) => t.worker.terminate()));
	return run;
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const median = (list) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : 0);

function parse() {
	const { values } = parseArgs({
		options: {
			"dry-run": { type: "boolean", default: false },
			only: { type: "string", multiple: true },
			"keys-file": { type: "string" },
			missing: { type: "boolean", default: false },
			limit: { type: "string" },
			concurrency: { type: "string" },
			workers: { type: "string" },
			manifest: { type: "string" },
			"local-dir": { type: "string" },
			"out-dir": { type: "string" },
			backend: { type: "string" },
			bucket: { type: "string", default: "tlhp-media" },
			profile: { type: "string", default: "tlhp" },
			verify: { type: "boolean", default: false },
			sample: { type: "string", default: "20" },
			quiet: { type: "boolean", default: false },
			help: { type: "boolean", default: false },
		},
	});
	return values;
}

async function backendFor(args) {
	if (args["local-dir"]) {
		const dir = path.resolve(args["local-dir"]);
		return { backend: localBackend(dir, path.resolve(args["out-dir"] ?? `${dir}-variants`)), concurrency: 4 };
	}
	const s3 = process.env.R2_S3_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;
	const which = args.backend ?? (s3 ? "s3" : "cf");
	if (which === "s3") {
		if (!s3) throw new Error("--backend s3 needs R2_S3_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in the environment");
		return { backend: await s3Backend(args.bucket), concurrency: 32 };
	}
	if (which !== "cf") throw new Error(`unknown --backend ${which}`);
	return { backend: cfBackend(args.bucket, args.profile), concurrency: 12 };
}

/** Pictures and their variants under the prefixes / keys asked for: Map key -> { entry, variants: Map("<step>.<format>" -> entry) } */
async function inventory(backend, args) {
	const entries = new Map();
	const add = (list) => list.forEach((entry) => entries.set(entry.key, entry));
	if (args["keys-file"]) {
		const text = fs.readFileSync(args["keys-file"], "utf8").trim();
		const keys = (text.startsWith("[") ? JSON.parse(text) : text.split(/\r?\n/)).map((k) => String(k).trim()).filter(Boolean);
		// One listing per folder, not per key (thousands of keys would bring on the API's 429): the folder's objects, kept when they are one of the
		// asked keys or one of their variants.
		const wanted = new Set(keys);
		const folders = [...new Set(keys.map((key) => key.slice(0, key.lastIndexOf("/") + 1)))];
		await pool(folders, 3, async (folder) =>
			add((await backend.list(folder)).filter((e) => wanted.has(e.key) || wanted.has(e.key.slice(0, Math.max(e.key.lastIndexOf("@"), 0)) || e.key))));
	} else {
		const prefixes = (args.only ?? []).flatMap((p) => p.split(",")).filter(Boolean);
		for (const prefix of prefixes.length ? prefixes : [""]) add(await backend.list(prefix));
	}
	const pictures = new Map();
	const skipped = { notImage: 0, atKey: 0 };
	for (const entry of [...entries.values()].sort((a, b) => (a.key < b.key ? -1 : 1))) {
		const variant = VARIANT_KEY.exec(entry.key);
		if (variant) continue;
		if (!SOURCE.test(entry.key)) skipped.notImage++;
		else if (entry.key.includes("@")) skipped.atKey++;
		else pictures.set(entry.key, { entry, variants: new Map() });
	}
	for (const entry of entries.values()) {
		const variant = VARIANT_KEY.exec(entry.key);
		const picture = variant && pictures.get(entry.key.slice(0, variant.index));
		if (picture) picture.variants.set(`${variant[1]}.${variant[2]}`, entry);
	}
	return { pictures, skipped };
}

const fresh = (variant, original) => (variant.meta?.["src-etag"] ? variant.meta["src-etag"] === original.etag : variant.modified >= original.modified);

async function generate(args, backend, concurrency) {
	const dry = args["dry-run"];
	const quiet = args.quiet;
	const { pictures, skipped } = await inventory(backend, args);
	let todo = [...pictures.entries()];
	if (args.missing) todo = todo.filter(([, picture]) => picture.variants.size === 0);
	const limit = Number(args.limit ?? 0);
	if (limit > 0) todo = todo.slice(0, limit);
	const workers = args.workers !== undefined ? Number(args.workers) : Math.max(1, Math.min(4, os.cpus().length - 2));
	const inFlight = Number(args.concurrency ?? concurrency);
	console.error(`${backend.name}: ${pictures.size} pictures found (${skipped.notImage} other files and ${skipped.atKey} keys with "@" left alone), ${todo.length} to do${dry ? ", DRY RUN: nothing is written" : ""}`);

	const manifest = args.manifest ? fs.createWriteStream(args.manifest, { flags: "a" }) : null;
	const log = (record) => manifest?.write(`${JSON.stringify(record)}\n`);
	const run = makeCompute(workers);
	const totals = {
		pictures: todo.length, skipped: {}, failed: 0, originalBytes: 0, bytes: { avif: 0, webp: 0 }, count: { avif: 0, webp: 0 }, existing: 0,
		refused: { gate: 0, bigger: 0, error: 0 }, written: 0, ssim: [], p5: [], q: { avif: {}, webp: {} }, perStep: {},
	};
	const started = Date.now();
	let done = 0;

	await pool(todo, inFlight, async ([key, picture]) => {
		try {
			const have = [...picture.variants].filter(([, variant]) => fresh(variant, picture.entry)).map(([name]) => name);
			const bytes = await backend.get(key);
			const result = await run({ key, bytes, have });
			if (result.skipped) {
				totals.skipped[result.skipped.split(":")[0]] = (totals.skipped[result.skipped.split(":")[0]] ?? 0) + 1;
				log({ type: "skip", key, reason: result.skipped });
				if (!quiet) console.error(`[${++done}/${todo.length}] ${key}: skipped (${result.skipped})`);
				return;
			}
			totals.originalBytes += bytes.length;
			log({ type: "image", key, W: result.W, H: result.H, bytes: bytes.length, format: result.srcFormat, alpha: result.alpha, etag: picture.entry.etag });
			const wrote = { avif: 0, webp: 0 };
			for (const v of result.variants) {
				const variantKey = `${key}@${v.step}.${v.format}`;
				const record = { type: "variant", key, variantKey, W: result.W, H: result.H, step: v.step, format: v.format, w: v.w, h: v.h, bytes: v.bytes, q: v.q, ssim: v.ssim === undefined ? undefined : +v.ssim.toFixed(5), p5: v.p5 === undefined ? undefined : +v.p5.toFixed(4), status: v.status };
				if (v.status === "exists") {
					totals.existing++;
				} else if (v.status === "ok") {
					totals.count[v.format]++;
					totals.bytes[v.format] += v.bytes;
					totals.ssim.push(v.ssim);
					totals.p5.push(v.p5);
					totals.q[v.format][v.q] = (totals.q[v.format][v.q] ?? 0) + 1;
					const step = (totals.perStep[v.step] ??= { avif: [], webp: [] });
					step[v.format].push(v.bytes);
					wrote[v.format]++;
					if (!dry) {
						// The key always has "@": an original can never be overwritten through here.
						if (!variantKey.includes("@")) throw new Error(`refusing to write ${variantKey}`);
						await backend.put(variantKey, Buffer.from(v.data.buffer, v.data.byteOffset, v.data.byteLength), {
							type: TYPE[v.format],
							meta: { src: key, "src-etag": picture.entry.etag, w: String(v.w), h: String(v.h), q: String(v.q), ssim: v.ssim.toFixed(4), gen: GENERATOR },
						});
						totals.written++;
						record.status = "written";
					} else record.status = "would-write";
				} else totals.refused[v.status] = (totals.refused[v.status] ?? 0) + 1;
				log(record);
			}
			if (!quiet) console.error(`[${++done}/${todo.length}] ${key} ${result.W}x${result.H} ${kb(bytes.length)}: avif ${wrote.avif}, webp ${wrote.webp}`);
		} catch (error) {
			totals.failed++;
			log({ type: "error", key, message: String(error.message).slice(0, 200) });
			console.error(`[${++done}/${todo.length}] ${key}: FAILED ${String(error.message).slice(0, 160)}`);
		}
	});
	await run.close?.();
	await new Promise((resolve) => (manifest ? manifest.end(resolve) : resolve()));

	const seconds = (Date.now() - started) / 1000;
	const sum = totals.bytes.avif + totals.bytes.webp;
	console.log(`\n${dry ? "DRY RUN " : ""}${totals.pictures} pictures in ${seconds.toFixed(0)} s (${workers} workers, ${inFlight} at once)`);
	console.log(`originals read: ${mb(totals.originalBytes)}; variants ${dry ? "that would be written" : "written"}: AVIF ${totals.count.avif} files ${mb(totals.bytes.avif)}, WebP ${totals.count.webp} files ${mb(totals.bytes.webp)} (together ${mb(sum)}, ${totals.originalBytes ? ((100 * sum) / totals.originalBytes).toFixed(0) : 0}% of the originals)`);
	console.log(`ratio to the originals: AVIF ${(totals.bytes.avif / (totals.originalBytes || 1)).toFixed(2)}, WebP ${(totals.bytes.webp / (totals.originalBytes || 1)).toFixed(2)}`);
	console.log(`already there and fresh: ${totals.existing}; refused by the gate: ${totals.refused.gate}; not smaller than the original-size rule: ${totals.refused.bigger}; encode errors: ${totals.refused.error}; pictures skipped: ${JSON.stringify(totals.skipped)}; failed: ${totals.failed}`);
	if (totals.ssim.length) console.log(`SSIM-Y of the chosen variants: median ${median(totals.ssim).toFixed(4)}, lowest ${Math.min(...totals.ssim).toFixed(4)}; p5 median ${median(totals.p5).toFixed(3)}, lowest ${Math.min(...totals.p5).toFixed(3)}`);
	console.log(`quality chosen: AVIF ${JSON.stringify(totals.q.avif)}, WebP ${JSON.stringify(totals.q.webp)}`);
	for (const step of [...LADDER.map(String), "max"]) {
		const row = totals.perStep[step];
		if (row) console.log(`  @${step.padEnd(4)} AVIF ${String(row.avif.length).padStart(4)} files, median ${kb(median(row.avif))}; WebP ${String(row.webp.length).padStart(4)} files, median ${kb(median(row.webp))}`);
	}
	if (totals.written) console.log(`written to the bucket: ${totals.written} objects`);
	return totals.failed ? 1 : 0;
}

async function verify(args, backend) {
	const { pictures } = await inventory(backend, args);
	const variants = [];
	for (const [key, picture] of pictures) for (const [name, entry] of picture.variants) variants.push({ key, name, entry, picture });
	const count = Math.min(Number(args.sample), variants.length);
	for (let i = variants.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[variants[i], variants[j]] = [variants[j], variants[i]];
	}
	const sample = variants.slice(0, count);
	console.error(`${backend.name}: ${variants.length} variants of ${pictures.size} pictures, checking ${sample.length}`);
	let bad = 0;
	const originals = new Map();
	for (const { key, name, entry, picture } of sample) {
		try {
			const [step, format] = name.split(".");
			const original = originals.get(key) ?? (await sharp(await backend.get(key), SHARP).rotate().toColourspace("srgb").raw({ depth: "uchar" }).toBuffer({ resolveWithObject: true }));
			originals.clear();
			originals.set(key, original);
			const picked = await backend.get(`${key}@${name}`);
			const back = await decode(picked);
			const W = original.info.width;
			const wantW = step === "max" ? Math.min(W, MAX_WIDTH) : Number(step);
			const wantH = Math.round((original.info.height * wantW) / W);
			const problems = [];
			if (back.info.width !== wantW || Math.abs(back.info.height - wantH) > 1) problems.push(`size ${back.info.width}x${back.info.height}, expected ${wantW}x${wantH}`);
			if (entry.type && entry.type !== TYPE[format]) problems.push(`content type ${entry.type}`);
			if (!fresh(entry, picture.entry)) problems.push("older than the original");
			const reference = await sharp(original.data, { raw: { width: W, height: original.info.height, channels: original.info.channels } })
				.resize({ width: back.info.width, height: back.info.height, fit: "fill", kernel: "lanczos3" }).raw().toBuffer({ resolveWithObject: true });
			let score = { mean: 0, p5: 0 };
			if (back.info.width === reference.info.width && back.info.height === reference.info.height) {
				score = ssim(luma(reference.data, reference.info.width, reference.info.height, reference.info.channels), luma(back.data, back.info.width, back.info.height, back.info.channels), back.info.width, back.info.height);
			}
			if (score.mean < GATE.ssim || score.p5 < GATE.p5) problems.push(`below the gate (SSIM-Y ${score.mean.toFixed(4)}, p5 ${score.p5.toFixed(3)})`);
			if (problems.length) bad++;
			console.log(`${problems.length ? "BAD" : "ok "} ${key}@${name} ${kb(picked.length)} of ${kb(picture.entry.size)}: SSIM-Y ${score.mean.toFixed(4)} p5 ${score.p5.toFixed(3)}${problems.length ? ` <- ${problems.join("; ")}` : ""}`);
		} catch (error) {
			bad++;
			console.log(`BAD ${key}@${name}: ${String(error.message).slice(0, 160)}`);
		}
	}
	console.log(`\nchecked ${sample.length}, ${bad} bad`);
	return bad ? 1 : 0;
}

async function main() {
	const args = parse();
	if (args.help) return void console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
	const { backend, concurrency } = await backendFor(args);
	process.exitCode = args.verify ? await verify(args, backend) : await generate(args, backend, concurrency);
}

if (isMainThread && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(String(error?.message ?? error));
		process.exit(2);
	});
}

// Source "b2": the JSON files the old admin writes to its Backblaze B2 bucket, read through
// B2's S3 API with a read-only application key (a Worker secret, never in the browser),
// requests signed with aws4fetch. The site never writes to the bucket.
//
// A file is asked for again at most once a minute; the request carries its ETag, so an
// unchanged file costs a 304 and no download. The Workers of one Cloudflare location share
// the last copy through the Cache API. When the bucket fails or a file comes back broken,
// the last good copy stays in use and the error goes to the log.
import { AwsClient } from "aws4fetch";
import type { ReadFile, SourceFile } from "./files";

export type B2Config = {
	/** "https://s3.us-east-005.backblazeb2.com" */
	endpoint: string;
	region: string;
	bucket: string;
	/** Folder of the files in the bucket, "" or ending in "/". */
	prefix: string;
	keyId: string;
	key: string;
};

const REQUIRED = { endpoint: "B2_ENDPOINT", bucket: "B2_BUCKET", keyId: "B2_KEY_ID", key: "B2_APPLICATION_KEY" } as const;

/** The settings from the environment (B2_PREFIX may be empty: files at the bucket's root). Names what is missing, never a value. */
export function b2Config(env: Record<string, string | undefined>): B2Config {
	const value = (name: string) => env[name]?.trim() ?? "";
	const missing = Object.values(REQUIRED).filter((name) => !value(name));
	if (missing.length) throw new Error(`Nguồn b2 thiếu biến môi trường: ${missing.join(", ")}`);
	const endpoint = value(REQUIRED.endpoint).replace(/\/+$/, "");
	const region = value("B2_REGION") || /^https:\/\/s3\.([a-z0-9-]+)\.backblazeb2\.com$/.exec(endpoint)?.[1] || "";
	if (!region) throw new Error("Nguồn b2: không đọc được vùng từ B2_ENDPOINT, đặt B2_REGION");
	const prefix = value("B2_PREFIX").replace(/^\/+|\/+$/g, "");
	return { endpoint, region, bucket: value(REQUIRED.bucket), prefix: prefix ? `${prefix}/` : "", keyId: value(REQUIRED.keyId), key: value(REQUIRED.key) };
}

/** The part of the Workers Cache API used here (`caches.default`). */
export type CacheLike = {
	match(request: Request): Promise<Response | undefined>;
	put(request: Request, response: Response): Promise<void>;
};

export type B2ReaderOptions = {
	fetch?: (request: Request) => Promise<Response>;
	cache?: CacheLike;
	now?: () => number;
	/** How long a copy is used before B2 is asked again, in ms. */
	ttl?: number;
	log?: Pick<Console, "error">;
};

type Entry = { file: SourceFile; checked: number };

const CACHE_HOST = "https://b2-cache.tunglamhoaphuc.internal";
const KEEP = "public, max-age=604800";

export function createB2Reader(config: B2Config, options: B2ReaderOptions = {}): ReadFile {
	const send = options.fetch ?? ((request: Request) => fetch(request));
	const now = options.now ?? Date.now;
	const ttl = options.ttl ?? 60_000;
	const log = options.log ?? console;
	const cache = options.cache;
	const client = new AwsClient({ accessKeyId: config.keyId, secretAccessKey: config.key, service: "s3", region: config.region });
	const memo = new Map<string, Entry>();

	const cacheKeys = (key: string) => ({ data: new Request(`${CACHE_HOST}/${config.bucket}/${key}`), checked: new Request(`${CACHE_HOST}/${config.bucket}/${key}?checked`) });

	async function fromCache(key: string): Promise<Entry | undefined> {
		if (!cache) return undefined;
		const keys = cacheKeys(key);
		const data = await cache.match(keys.data);
		if (!data) return undefined;
		const checked = Number(await (await cache.match(keys.checked))?.text()) || 0;
		try {
			return { file: { version: data.headers.get("etag") ?? "", data: JSON.parse(await data.text()) }, checked };
		} catch {
			return undefined;
		}
	}

	async function toCache(key: string, entry: Entry, text?: string): Promise<void> {
		if (!cache) return;
		const keys = cacheKeys(key);
		if (text !== undefined) await cache.put(keys.data, new Response(text, { headers: { etag: entry.file.version, "content-type": "application/json", "cache-control": KEEP } }));
		await cache.put(keys.checked, new Response(String(entry.checked), { headers: { "cache-control": KEEP } }));
	}

	return async (name) => {
		const key = `${config.prefix}${name}.json`;
		const url = `${config.endpoint}/${config.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
		let entry = memo.get(name) ?? (await fromCache(key));
		if (entry && now() - entry.checked < ttl) {
			memo.set(name, entry);
			return entry.file;
		}
		try {
			const request = await client.sign(url, { method: "GET", headers: entry ? { "if-none-match": entry.file.version } : {} });
			const response = await send(request);
			if (response.status === 304 && entry) {
				entry = { file: entry.file, checked: now() };
				memo.set(name, entry);
				await toCache(key, entry);
				return entry.file;
			}
			if (response.status === 404 && !entry) return null;
			if (!response.ok) throw new Error(`B2 trả ${response.status}`);
			const text = await response.text();
			const data: unknown = JSON.parse(text);
			entry = { file: { version: response.headers.get("etag") ?? `${text.length}`, data }, checked: now() };
			memo.set(name, entry);
			await toCache(key, entry, text);
			return entry.file;
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			if (!entry) throw new Error(`[b2] Không đọc được ${key}: ${reason}`, { cause: error });
			log.error(`[b2] ${key}: ${reason}; giữ bản ${entry.file.version}`);
			// Ask again after the usual wait, not on every request while B2 is down.
			memo.set(name, { file: entry.file, checked: now() });
			return entry.file;
		}
	};
}

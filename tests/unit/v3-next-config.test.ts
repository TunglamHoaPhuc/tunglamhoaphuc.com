// next.config.ts: tiêu đề bảo mật, noindex theo host, chuyển hướng tên miền gốc và admin. Mẫu từ tests/unit/next-config.test.ts của
// www (E:\tlhp-av3). Mọi luật theo host phải KHÔNG chạy ở host khác (v3., thu., workers.dev, localhost).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import nextConfig from "../../next.config";
import { BARE_HOST, isPublicHost, PUBLIC_HOST } from "@/lib/v3-hosts";
import { MOVED_PATHS } from "@/lib/site-url";

type Cond = { type: string; value?: string };
type HeaderRule = { source: string; has?: Cond[]; missing?: Cond[]; headers: { key: string; value: string }[] };
type RedirectRule = { source: string; has?: Cond[]; destination: string; permanent: boolean };

const headerRules = async () => ((await nextConfig.headers?.()) ?? []) as HeaderRule[];
const redirectRules = async () => ((await nextConfig.redirects?.()) ?? []) as RedirectRule[];
const hostRe = (value: string | undefined) => new RegExp(`^${value}$`);

const PUBLIC = ["www.tunglamhoaphuc.com", "tunglamhoaphuc.com", "www.tunglamhoaphuc.com:443"];
const OTHER = ["v3.tunglamhoaphuc.com", "thu.tunglamhoaphuc.com", "quantri.tunglamhoaphuc.com", "tlhp-v3.example.workers.dev", "localhost:3011", "www.tunglamhoaphuc.com.evil.example", "wwwxtunglamhoaphuc.com"];

test("hai bản host công khai (next.config.ts và src/lib/v3-hosts.ts) khớp nhau", async () => {
	const rules = await headerRules();
	const robots = rules.find((rule) => rule.missing?.some((c) => c.type === "host"));
	assert.equal(robots?.missing?.[0].value, PUBLIC_HOST, "next.config.ts phải dùng đúng chuỗi regex của v3-hosts.ts");
	const bare = (await redirectRules()).find((rule) => rule.source === "/:path*");
	assert.equal(bare?.has?.[0].value, BARE_HOST);
	for (const host of PUBLIC) assert.equal(isPublicHost(host), true, host);
	for (const host of OTHER) assert.equal(isPublicHost(host), false, host);
	for (const host of PUBLIC) assert.ok(hostRe(PUBLIC_HOST).test(host), host);
	for (const host of OTHER) assert.ok(!hostRe(PUBLIC_HOST).test(host), host);
});

test("host nào ngoài www và tên miền gốc cũng nhận X-Robots-Tag: noindex, nofollow, còn www thì không", async () => {
	const rules = await headerRules();
	const catchAll = rules.find((rule) => rule.source === "/:path*" && rule.missing);
	assert.deepEqual(catchAll?.headers, [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);
	// "missing" host công khai: luật áp cho v3., thu., workers.dev, localhost; không áp cho www.
	const condition = catchAll?.missing?.find((c) => c.type === "host");
	assert.ok(condition);
	for (const host of PUBLIC) assert.equal(hostRe(condition.value).test(host), true, `${host} khớp điều kiện missing, tức luật KHÔNG áp`);
	for (const host of OTHER) assert.equal(hostRe(condition.value).test(host), false, `${host} không khớp, tức luật áp`);
	// Chỉ đúng một luật đặt noindex, và nó luôn có điều kiện host: không có luật noindex vô điều kiện nào.
	const noindex = rules.filter((rule) => rule.headers.some((h) => h.key === "X-Robots-Tag"));
	assert.equal(noindex.length, 1);
	assert.ok(noindex[0].missing?.length);
});

test("tiêu đề bảo mật gửi trên mọi host (không điều kiện) và không có Content-Security-Policy ở trang công khai", async () => {
	const rules = await headerRules();
	const everywhere = rules.filter((rule) => rule.source === "/:path*" && !rule.missing && !rule.has);
	const headers = Object.fromEntries(everywhere.flatMap((rule) => rule.headers).map(({ key, value }) => [key, value]));
	assert.equal(headers["Strict-Transport-Security"], "max-age=31536000", "HSTS một năm, không includeSubDomains");
	assert.equal(headers["X-Frame-Options"], "SAMEORIGIN");
	assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
	assert.equal(headers["X-Content-Type-Options"], "nosniff");
	assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
	assert.equal(headers["Content-Security-Policy"], undefined);
	assert.doesNotMatch(headers["Strict-Transport-Security"], /includeSubDomains|preload/i);
});

test("chuyển hướng admin: /quan-tri, /api/quan-tri, /admin, /login, /van-hanh sang quantri., tạm thời, chỉ trên host công khai", async () => {
	const rules = await redirectRules();
	const sources = rules.map((rule) => rule.source);
	for (const path of ["/quan-tri", "/api/quan-tri", "/admin", "/login", "/van-hanh"]) {
		for (const source of [path, `${path}/:rest*`]) {
			const rule = rules.find((item) => item.source === source);
			assert.ok(rule, `thiếu luật ${source}`);
			assert.equal(rule.permanent, false, `${source}: 307 tạm thời cho tới khi chốt`);
			// The old site's admin addresses lead to the new admin's front door (the same path on quantri. would loop back to www).
			const old = ["/admin", "/login", "/van-hanh"].includes(path);
			const expected = old ? "https://quantri.tunglamhoaphuc.com/quan-tri" : source.endsWith(":rest*") ? `https://quantri.tunglamhoaphuc.com${path}/:rest*` : `https://quantri.tunglamhoaphuc.com${path}`;
			assert.equal(rule.destination, expected);
			assert.equal(rule.has?.length, 1);
			for (const host of PUBLIC) assert.equal(hostRe(rule.has?.[0].value).test(host), true, `${source} chạy ở ${host}`);
			for (const host of OTHER) assert.equal(hostRe(rule.has?.[0].value).test(host), false, `${source} không chạy ở ${host}`);
		}
	}
	// Không có luật nào ghép tiền tố quá rộng: /quan-tri-gia không bị bắt.
	assert.ok(!sources.includes("/quan-tri-gia"));
	assert.ok(!sources.includes("/quan-tri:path*"));
});

test("tên miền gốc chuyển 308 về www, giữ đường dẫn, và chỉ ở tên miền gốc", async () => {
	const rules = await redirectRules();
	const bare = rules.find((rule) => rule.source === "/:path*");
	assert.ok(bare);
	assert.equal(bare.destination, "https://www.tunglamhoaphuc.com/:path*");
	assert.equal(bare.permanent, true);
	for (const host of ["tunglamhoaphuc.com", "tunglamhoaphuc.com:443"]) assert.equal(hostRe(bare.has?.[0].value).test(host), true, host);
	for (const host of ["www.tunglamhoaphuc.com", ...OTHER]) assert.equal(hostRe(bare.has?.[0].value).test(host), false, host);
	// Luật admin đứng TRƯỚC luật tên miền gốc: tunglamhoaphuc.com/quan-tri sang thẳng quantri., không vòng qua www.
	const order = rules.map((rule) => rule.source);
	assert.ok(order.indexOf("/quan-tri") < order.indexOf("/:path*"));
});

test("mọi luật có điều kiện host đều có điều kiện (không luật theo host nào chạy ở host khác)", async () => {
	for (const rule of await redirectRules()) {
		if (rule.destination.startsWith("https://")) assert.ok(rule.has?.some((c) => c.type === "host"), `${rule.source} → ${rule.destination} phải có điều kiện host`);
	}
});

test("địa chỉ cũ đã chuyển hướng cố định (MOVED_PATHS) đúng là luật của next.config.ts, 308", async () => {
	const rules = await redirectRules();
	for (const [from, to] of Object.entries(MOVED_PATHS)) {
		const rule = rules.find((item) => item.source === from);
		assert.ok(rule, from);
		assert.equal(rule.destination, to);
		assert.equal(rule.permanent, true);
	}
});

test("một tượng một địa chỉ: /bao-tuong-phat-giao/{slug} và /bao-tuong chuyển 308 về địa chỉ chuẩn", async () => {
	const rules = await redirectRules();
	const detail = rules.find((rule) => rule.source === "/bao-tuong-phat-giao/:slug");
	assert.deepEqual([detail?.destination, detail?.permanent], ["/bao-tuong/:slug", true]);
	const list = rules.find((rule) => rule.source === "/bao-tuong");
	assert.deepEqual([list?.destination, list?.permanent], ["/bao-tuong-phat-giao", true]);
});

test("tệp tĩnh: _headers đặt cache dài cho /_next/static, /images, /fonts và ngắn cho phần còn lại; các đường dẫn đó rời khỏi runWorkerFirst", () => {
	const text = readFileSync("public/_headers", "utf8");
	const blocks = new Map<string, string>();
	let current = "";
	for (const line of text.split(/\r?\n/)) {
		if (!line.trim() || line.startsWith("#")) continue;
		if (!line.startsWith(" ")) current = line.trim();
		else blocks.set(current, line.trim());
	}
	const LONG = "Cache-Control: public, max-age=31536000, immutable";
	for (const path of ["/_next/static/*", "/images/*", "/fonts/*"]) assert.equal(blocks.get(path), LONG, path);
	for (const path of ["/brand/*", "/tibetan-study/*", "/*.TTF"]) {
		const value = blocks.get(path);
		assert.ok(value, path);
		const age = Number(/max-age=(\d+)/.exec(value)?.[1]);
		assert.ok(age > 0 && age <= 86400, `${path}: ngắn (≤ 1 ngày), thấy ${value}`);
		assert.doesNotMatch(value, /immutable/);
	}
	const cloudflare = readFileSync("cloudflare.config.ts", "utf8");
	for (const path of ["/_next/static/*", "/images/*", "/brand/*", "/fonts/*", "/tibetan-study/*", "/*.TTF"]) {
		assert.ok(cloudflare.includes(`"!${path}"`), `${path} phải bị loại khỏi runWorkerFirst để _headers có tác dụng`);
	}
});

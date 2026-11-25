// V8: lớp đọc và bộ lọc HTML của V3 là BẢN CHÉP của www. Hai nhóm kiểm thử giữ chúng không lệch nhau:
//  1. So mã nguồn (cần TLHP_WWW_SRC = thư mục `src` của www, ví dụ E:\tlhp-av3\src; không đặt thì bỏ qua): mỗi tệp của
//     src/lib/tlhp-content/** so với src/libs/content/** của www, và hai bộ lọc HTML so với src/admin/{content,special}/html.ts. Chỉ được
//     khác ở xuống dòng (CRLF/LF) và ở dòng import trỏ tới CÙNG một mô-đun (đường dẫn khác vì cây thư mục khác).
//  2. So hành vi (cần thêm TLHP_REAL_DB): chạy bộ lọc của V3 và của www trên MỌI thân bài trong dữ liệu thật, cùng một bộ đầu vào
//     hiểm, kết quả phải giống từng byte.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { markdownOf, parseSafe, plainText, sanitizeHtml, serialize, textOf } from "@/lib/tlhp-admin/content/html";
import { cleanBodyHtml } from "@/lib/tlhp-admin/special/html";
import { openReal, rows, SKIP_REAL } from "../helpers/real-db";

const WWW = process.env.TLHP_WWW_SRC;
const V3 = path.resolve("src");
const SKIP_WWW: string | false = WWW && existsSync(WWW) ? false : "TLHP_WWW_SRC chưa đặt (thư mục src của www): bỏ qua so khớp với www";

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});

const lf = (text: string) => text.replace(/\r\n/g, "\n");
/** `from "…"` of an import (also the closing line of a multi-line one) → its specifier; the rest of the line is kept. */
const IMPORT_FROM = /^((?:import\b[^"'\n]*|\}\s*)from\s+)["']([^"']+)["'](;?)$/;
const SIDE_EFFECT_IMPORT = /^(import\s+)["']([^"']+)["'](;?)$/;
const DYNAMIC_IMPORT = /import\(\s*["']([^"']+)["']\s*\)/g;

/** The www file that counterpart of a V3 file is: the V3 tree keeps www's `admin/` and `libs/` under `lib/tlhp-admin/`, `lib/tlhp-content/`, `lib/`. */
function toWww(v3File: string): string {
	const rel = path.relative(V3, v3File).split(path.sep).join("/");
	if (rel.startsWith("lib/tlhp-admin/")) return path.join(WWW as string, "admin", rel.slice("lib/tlhp-admin/".length));
	if (rel.startsWith("lib/tlhp-content/")) return path.join(WWW as string, "libs/content", rel.slice("lib/tlhp-content/".length));
	if (rel.startsWith("lib/tlhp-site/")) return path.join(WWW as string, "libs", rel.slice("lib/tlhp-site/".length));
	if (rel.startsWith("lib/")) return path.join(WWW as string, "libs", rel.slice("lib/".length));
	throw new Error(`không có bản www cho ${rel}`);
}

const stripExt = (file: string) => file.replace(/\.(ts|tsx|js|mjs)$/, "");
/** Where an import goes, as a path with no extension; `@/…` is the V3 or www `src`. Packages stay as written. */
function target(file: string, specifier: string, root: string): string {
	if (specifier.startsWith(".")) return stripExt(path.resolve(path.dirname(file), specifier)).replace(/\\/g, "/");
	if (specifier.startsWith("@/")) return stripExt(path.join(root, specifier.slice(2))).replace(/\\/g, "/");
	return specifier;
}

/** The file with each import's specifier replaced by what it points to, in www's terms (V3 targets mapped to their www counterpart). */
function normalised(file: string, side: "v3" | "www"): string {
	const own = side === "v3" ? V3 : (WWW as string);
	const map = (specifier: string) => {
		const where = target(file, specifier, own);
		if (!path.isAbsolute(where) && !/^[a-zA-Z]:/.test(where)) return where; // a package
		return side === "v3" ? stripExt(toWww(`${where}.ts`)).replace(/\\/g, "/") : where;
	};
	return lf(readFileSync(file, "utf8"))
		.split("\n")
		.map((line) => {
			const trimmed = line.trimEnd();
			const named = IMPORT_FROM.exec(trimmed.trim());
			if (named) return `${line.slice(0, line.length - line.trimStart().length)}${named[1]}"${map(named[2])}"${named[3]}`;
			const bare = SIDE_EFFECT_IMPORT.exec(trimmed.trim());
			if (bare) return `${bare[1]}"${map(bare[2])}"${bare[3]}`;
			return line.replace(DYNAMIC_IMPORT, (_all, specifier: string) => `import("${map(specifier)}")`);
		})
		.join("\n");
}

function compare(v3File: string, wwwFile: string) {
	assert.ok(existsSync(wwwFile), `www không có ${wwwFile}`);
	assert.equal(normalised(v3File, "v3"), normalised(wwwFile, "www"), `${path.relative(V3, v3File)} lệch khỏi ${wwwFile} (chỉ được khác dòng import trỏ cùng mô-đun và kiểu xuống dòng)`);
}

test("tlhp-content (V3) và libs/content (www): cùng danh sách tệp, nội dung giống nhau trừ dòng import trỏ cùng mô-đun", { skip: SKIP_WWW }, () => {
	const mine = walk(path.join(V3, "lib/tlhp-content")).filter((f) => /\.tsx?$/.test(f));
	const theirs = walk(path.join(WWW as string, "libs/content")).filter((f) => /\.tsx?$/.test(f));
	const rel = (file: string, base: string) => path.relative(base, file).split(path.sep).join("/");
	assert.deepEqual(mine.map((f) => rel(f, path.join(V3, "lib/tlhp-content"))).sort(), theirs.map((f) => rel(f, path.join(WWW as string, "libs/content"))).sort(), "danh sách tệp");
	assert.ok(mine.length >= 17);
	for (const file of mine) compare(file, toWww(file));
});

test("renew-async.ts (đọc D1 giữ theo hạn, không chia sẻ lần đọc đang chạy) của V3 giống libs/renew-async.ts của www", { skip: SKIP_WWW }, () => {
	compare(path.join(V3, "lib/renew-async.ts"), toWww(path.join(V3, "lib/renew-async.ts")));
});

test("bộ lọc HTML của V3 (tlhp-admin/content/html.ts, special/html.ts) giống bản của www", { skip: SKIP_WWW }, () => {
	for (const rel of ["lib/tlhp-admin/content/html.ts", "lib/tlhp-admin/special/html.ts"]) compare(path.join(V3, rel), toWww(path.join(V3, rel)));
});

test("tlhp-site (V3: siteData, redirects) chỉ đọc các bảng mà www cũng đọc, và không ghi", { skip: SKIP_WWW }, () => {
	// Hai tệp này cố ý khác www (redirects.ts bỏ bộ đếm lượt chuyển hướng; siteData.ts không có dự phòng mặc định, đã ghi ở đầu tệp), nên không so từng dòng.
	const tables = (text: string) => new Set([...text.matchAll(/(?:from|join)\s+([a-z_]+)/gi)].map((m) => m[1].toLowerCase()).filter((name) => /^(setting|menu|menu_item|media|redirect)$/.test(name)));
	for (const file of ["redirects.ts", "siteData.ts"]) {
		const mine = lf(readFileSync(path.join(V3, "lib/tlhp-site", file), "utf8"));
		const www = lf(readFileSync(path.join(WWW as string, "libs", file), "utf8"));
		for (const name of tables(mine)) assert.ok(tables(www).has(name), `${file}: V3 đọc bảng ${name} mà www không đọc`);
		assert.doesNotMatch(mine, /(?:insert\s+into|update\s+\w+\s+set|delete\s+from|\.run\()/i, `${file}: V3 không được ghi`);
	}
});

// ── Hành vi: cùng đầu vào, cùng đầu ra ──────────────────────────────────────────────────────────────────────────────

type Www = {
	content: typeof import("@/lib/tlhp-admin/content/html");
	special: typeof import("@/lib/tlhp-admin/special/html");
};
let wwwModules: Promise<Www> | undefined;
const loadWww = () => (wwwModules ??= (async () => ({ content: await import(pathToFileURL(path.join(WWW as string, "admin/content/html.ts")).href), special: await import(pathToFileURL(path.join(WWW as string, "admin/special/html.ts")).href) }))());

/** Hostile and awkward inputs both sanitisers must treat alike (and safely). */
const NASTY = [
	"<p>Tuổi < 18 và 5 > 3 &amp; &lt;b&gt; &nbsp; &#x1F600; &bogus;</p>",
	'<script>alert(1)</script><p onclick="x()">ok</p><style>p{}</style><svg onload=x><circle/></svg>',
	'<a href="javascript:alert(1)">x</a><a href=" JaVa\tScRiPt:alert(1)">y</a><a href="https://example.org/a?b=1&c=2" target="_self">z</a><a href="//evil.example/">w</a><a href="/gioi-thieu">trong</a><a href="mailto:a@b.c">m</a>',
	'<img src="javascript:x"><img src="/anh-goc/s2-cnv03/a.webp" alt="a&quot;b" data-media-id="m1"><img src="https://evil.example/x.png"><figure><img src="/brand/x.webp"><figcaption>chú thích <b>đậm</b></figcaption></figure>',
	'<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe><iframe src="https://evil.example/"></iframe><div data-youtube-video><iframe src="https://www.youtube.com/embed/abc"></iframe></div>',
	'<audio src="/anh-goc/s2-cnv03/a.mp3" controls autoplay></audio><audio src="http://x/a.mp3"></audio>',
	"<table><thead><tr><th>A</th></tr></thead><tbody><tr><td colspan=2>1</td><td onclick=x>2</td></tr></tbody></table><h1>Một</h1><h5>Năm</h5><h6>Sáu</h6>",
	'<blockquote class="kinh">k</blockquote><blockquote class="tho">t</blockquote><blockquote class="khac evil">x</blockquote><ul><li>a<ul><li>b</li></ul></li></ul><ol start=3><li>c</li></ol><hr><s>g</s><del>d</del><strike>s</strike><u>u</u><i>i</i><b>b</b>',
	"<p>chưa đóng <strong>đậm <em>nghiêng</p><p>sau</p></strong></em><div><span>lồng</span></div><br/><br>",
	"<!-- chú thích --><p>a<![CDATA[x]]>b</p><?php echo 1 ?><p>c</p><textarea><b>x</b></textarea><title>t</title>",
	"x".repeat(2000) + "<p>" + "<b>".repeat(80) + "sâu" + "</b>".repeat(80) + "</p>",
	"",
	"chỉ chữ thường, không thẻ nào",
];

test("hành vi: bộ lọc content/html của V3 và của www cho cùng kết quả trên mọi thân bài thật và bộ đầu vào hiểm", { skip: SKIP_WWW || SKIP_REAL }, async () => {
	const www = await loadWww();
	const { sqlite } = openReal();
	const inputs: { where: string; html: string }[] = NASTY.map((html, i) => ({ where: `hiểm #${i}`, html }));
	for (const [table, column] of [["post", "content_html"], ["page", "content_html"], ["teaching_article", "content_html"], ["teaching_article", "body"], ["area", "content_html"], ["area", "intro"], ["statue", "body"]] as const) {
		for (const r of rows<Record<string, unknown>>(sqlite, `select slug, ${column} as h from ${table}`)) if (typeof r.h === "string") inputs.push({ where: `${table}.${column}/${r.slug}`, html: r.h });
	}
	assert.ok(inputs.length > 800);
	const differs: string[] = [];
	for (const { where, html } of inputs) {
		const changesV3: string[] = [];
		const changesWww: string[] = [];
		const a = sanitizeHtml(html, { changes: changesV3 });
		const b = www.content.sanitizeHtml(html, { changes: changesWww });
		if (a !== b) differs.push(`${where}: sanitizeHtml`);
		if (JSON.stringify(changesV3) !== JSON.stringify(changesWww)) differs.push(`${where}: changes`);
		if (serialize(parseSafe(html)) !== www.content.serialize(www.content.parseSafe(html))) differs.push(`${where}: serialize(parseSafe)`);
		if (textOf(parseSafe(html)) !== www.content.textOf(www.content.parseSafe(html))) differs.push(`${where}: textOf`);
		if (markdownOf(parseSafe(html)) !== www.content.markdownOf(www.content.parseSafe(html))) differs.push(`${where}: markdownOf`);
		if (plainText(html) !== www.content.plainText(html)) differs.push(`${where}: plainText`);
		// Đã lọc rồi lọc lại: không đổi (idempotent), ở cả hai bên.
		if (sanitizeHtml(a) !== a) differs.push(`${where}: V3 lọc lần hai khác lần một`);
		if (cleanBodyHtml(html) !== www.special.cleanBodyHtml(html)) differs.push(`${where}: cleanBodyHtml`);
		if (cleanBodyHtml(cleanBodyHtml(html)) !== cleanBodyHtml(html)) differs.push(`${where}: cleanBodyHtml lần hai khác lần một`);
	}
	console.log(`  ${inputs.length} đầu vào so khớp V3 với www`);
	assert.deepEqual(differs, []);
});

// Bộ đọc khối home.* của V3 (lib/tlhp-site/homeSettings.ts) là BẢN CHÉP từng byte của www (src/libs/homeSettings.ts): cùng một lược đồ zod,
// cùng cách bỏ phần sai. Hai nhóm kiểm thử giữ chúng không lệch (cần TLHP_WWW_SRC = thư mục `src` của www; không đặt thì bỏ qua):
//  1. So mã nguồn: chỉ được khác kiểu xuống dòng (CRLF/LF).
//  2. So hành vi: cùng đầu vào hiểm, hai bên cho cùng kết quả; và khung đầu trang của V3 chỉ dùng bộ đọc này.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import * as v3 from "@/lib/tlhp-site/homeSettings";

const WWW = process.env.TLHP_WWW_SRC;
const SKIP_WWW: string | false = WWW && existsSync(path.join(WWW, "libs/homeSettings.ts")) ? false : "TLHP_WWW_SRC chưa đặt (thư mục src của www): bỏ qua so khớp với www";

const lf = (text: string) => text.replace(/\r\n/g, "\n");

test("homeSettings.ts của V3 giống từng byte bản của www (trừ kiểu xuống dòng)", { skip: SKIP_WWW }, () => {
	const mine = lf(readFileSync(path.resolve("src/lib/tlhp-site/homeSettings.ts"), "utf8"));
	const theirs = lf(readFileSync(path.join(WWW as string, "libs/homeSettings.ts"), "utf8"));
	assert.equal(mine, theirs, "lib/tlhp-site/homeSettings.ts lệch khỏi src/libs/homeSettings.ts của www: chép lại tệp của www");
});

const slide = (over: Record<string, unknown> = {}) => ({ id: "s1", enabled: true, title: "Tiêu đề", subtitle: "Phụ", text: "Chữ", imageMediaId: "m1", portraitMediaId: null, imagePosition: "center", ctaLabel: "Xem", ctaHref: "/gioi-thieu", ...over });

const HERO_INPUTS: unknown[] = [
	null, undefined, 0, "x", [], {}, { slides: [] }, { slides: "không" },
	{ slides: [slide()], autoEvent: true, autoLatest: false },
	{ slides: [slide({ enabled: false }), slide({ id: "s2", title: "Hai" })] },
	{ slides: [slide({ title: "" }), slide({ id: "s2", ctaHref: "javascript:alert(1)" }), slide({ id: "s3", ctaHref: "//evil.example" }), slide({ id: "s4", ctaHref: "https://ok.example/x" })] },
	{ slides: Array.from({ length: 12 }, (_, i) => slide({ id: `s${i}` })) },
	{ slides: [slide({ title: "x".repeat(500) })] },
];
const WELCOME_INPUTS: unknown[] = [
	null, "x", [], {}, { videoUrl: "" },
	{ videoUrl: "https://youtu.be/dQw4w9WgXcQ", quote: "Lời", author: "Tác giả", paragraph: "Đoạn", imageMediaId: "m2", linkLabel: "Đọc", linkHref: "/gioi-thieu" },
	{ videoUrl: "https://vimeo.com/1" }, { videoUrl: "http://www.youtube.com/watch?v=dQw4w9WgXcQ" }, { videoUrl: "javascript:alert(1)" },
	{ videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x", linkHref: "javascript:x" },
	{ quote: "q".repeat(400), paragraph: 5 },
];
const STAT_INPUTS: unknown[] = [null, [], [{ label: "A", source: "manual", value: 3 }], [{ label: "", source: "manual", value: 3 }, { label: "B", source: "auto-phat-lich", value: 0 }], Array.from({ length: 5 }, (_, i) => ({ label: `L${i}`, source: "manual", value: i })), [{ label: "C", source: "lạ", value: 1 }], [{ label: "D", source: "manual", value: -1 }], [{ label: "E", source: "manual", value: 1.5 }]];
const YEAR_INPUTS: unknown[] = [null, {}, { mode: "auto", value: 2570 }, { mode: "manual", value: 2569 }, { mode: "manual", value: 0 }, { mode: "khác", value: 1 }, { mode: "manual", value: 10000 }];
const QUOTE_INPUTS: unknown[] = [null, {}, { source: "trich-dan", mode: "ngau-nhien" }, { source: "chu-de-thang", mode: "thu-tu" }, { source: "x", mode: "thu-tu" }];
const URLS = ["dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/live/dQw4w9WgXcQ", "http://youtu.be/dQw4w9WgXcQ", "ftp://youtu.be/dQw4w9WgXcQ", "https://youtu.be/short", "https://evil.example/watch?v=dQw4w9WgXcQ", "", "  dQw4w9WgXcQ  ", "javascript:alert(1)"];
const HREFS = ["", "/gioi-thieu", "//evil.example", "/a b", "/a\\b", "https://x.example/p?q=1", "https://", "http://x.example", "javascript:alert(1)", "mailto:a@b.c"];

test("hành vi: các bộ đọc khối home.* của V3 và của www cho cùng kết quả trên cùng đầu vào", { skip: SKIP_WWW }, async () => {
	const www = (await import(pathToFileURL(path.join(WWW as string, "libs/homeSettings.ts")).href)) as typeof v3;
	const same = (what: string, a: unknown, b: unknown) => assert.equal(JSON.stringify(a), JSON.stringify(b), what);
	HERO_INPUTS.forEach((input, i) => same(`readHero #${i}`, v3.readHero(input), www.readHero(input)));
	WELCOME_INPUTS.forEach((input, i) => same(`readWelcome #${i}`, v3.readWelcome(input), www.readWelcome(input)));
	STAT_INPUTS.forEach((input, i) => same(`readStats #${i}`, v3.readStats(input), www.readStats(input)));
	YEAR_INPUTS.forEach((input, i) => same(`readBuddhistYear #${i}`, v3.readBuddhistYear(input), www.readBuddhistYear(input)));
	QUOTE_INPUTS.forEach((input, i) => same(`readQuotesSetting #${i}`, v3.readQuotesSetting(input), www.readQuotesSetting(input)));
	for (const url of URLS) same(`youtubeId(${url})`, v3.youtubeId(url), www.youtubeId(url));
	for (const href of HREFS) same(`safeHref(${href})`, v3.safeHref(href), www.safeHref(href));
});

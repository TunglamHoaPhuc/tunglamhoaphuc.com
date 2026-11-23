// Trước khi V3 thành trang chính: những thứ không được công khai (đường AI/giọng đọc không giới hạn, danh sách bài vị đầy đủ,
// công cụ nội bộ, thanh trợ lý giả) và cách giới hạn từng thứ. Phần giới hạn chép từ www (tests/unit/tibetan.test.ts).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { mock, test } from "node:test";
import { isDevelopment } from "@/lib/dev-only";
import { MEMORIAL_MAX_RESULTS, MEMORIAL_MIN_QUERY, filterMemorialRecords, searchMemorialRecords } from "@/lib/memorial-db";
import { toPublicMemorialRecord, type MemorialRecord } from "@/lib/memorial-types";
import { allow, OverLimit, overLimit, tooMany } from "@/lib/rate-limit";
import { throttleIp } from "@/lib/throttle-ip";
import memorialData from "@/data/memorial-data.json";

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
const norm = (file: string) => file.split(path.sep).join("/");
const read = (file: string) => readFileSync(file, "utf8");
const sources = () => walk("src").map(norm).filter((f) => /\.(ts|tsx)$/.test(f));

const request = (ip: string | null, url = "https://www.example.test/api/analyze", extra: Record<string, string> = {}) =>
	new Request(url, { method: "POST", headers: { ...(ip ? { "cf-connecting-ip": ip } : {}), ...extra } });

// ── 1. Giới hạn theo khách và theo phút ─────────────────────────────────────────────────────────────────────────────

test("throttleIp: IPv6 gộp theo /64, IPv4 giữ nguyên, địa chỉ IPv4 nhúng trong IPv6 về IPv4", () => {
	assert.equal(throttleIp("203.0.113.9"), "203.0.113.9");
	assert.equal(throttleIp("2001:db8:aaaa:bbbb:1:2:3:4"), "2001:db8:aaaa:bbbb::/64");
	assert.equal(throttleIp("2001:db8:aaaa:bbbb:ffff:ffff:ffff:ffff"), "2001:db8:aaaa:bbbb::/64", "cùng /64, khác địa chỉ: cùng khóa");
	assert.equal(throttleIp("2001:DB8::1"), "2001:db8:0:0::/64");
	assert.equal(throttleIp("::ffff:198.51.100.7"), "198.51.100.7");
	assert.equal(throttleIp("không-phải-ip"), "không-phải-ip");
});

test("overLimit: mỗi khách `limit` lần một phút rồi từ chối, sang phút sau tính lại, khách và nhóm khác tính riêng", async () => {
	const at = Date.UTC(2026, 10, 23, 8, 0, 10);
	for (let i = 0; i < 3; i++) assert.equal(await overLimit(request("1.1.1.1"), "t1", 3, at), false, `lần ${i + 1}`);
	assert.equal(await overLimit(request("1.1.1.1"), "t1", 3, at), true);
	assert.equal(await overLimit(request("2.2.2.2"), "t1", 3, at), false);
	assert.equal(await overLimit(request("1.1.1.1"), "t2", 3, at), false);
	assert.equal(await overLimit(request("1.1.1.1"), "t1", 3, at + 60_000), false);
});

test("overLimit đếm theo /64 của IPv6: đổi địa chỉ trong cùng /64 không thoát được hạn mức", async () => {
	const at = Date.UTC(2026, 10, 23, 9, 0, 10);
	for (let i = 0; i < 2; i++) assert.equal(await overLimit(request(`2001:db8:1:2:${i}::1`), "t-v6", 2, at), false);
	assert.equal(await overLimit(request("2001:db8:1:2:ffff::9"), "t-v6", 2, at), true);
	assert.equal(await overLimit(request("2001:db8:1:3::1"), "t-v6", 2, at), false, "/64 khác là khách khác");
});

test("tooMany: 429, Retry-After, lời tiếng Việt, và `answer` cho ô hỏi đáp", async () => {
	const response = tooMany();
	assert.equal(response.status, 429);
	assert.equal(response.headers.get("retry-after"), "60");
	const body = (await response.json()) as { message: string; answer: string };
	assert.match(body.message, /đợi một phút/);
	assert.equal(body.answer, body.message);
});

test("allow ném OverLimit khi quá hạn mức, và chỉ tin cf-connecting-ip (x-forwarded-for tự đặt không thoát được)", async () => {
	for (let i = 0; i < 2; i++) await allow(request("9.9.9.9"), "t-allow", 2);
	await assert.rejects(() => allow(request("9.9.9.9"), "t-allow", 2), OverLimit);
	for (let i = 0; i < 2; i++) await allow(request(null, undefined, { "x-forwarded-for": `8.8.8.${i}` }), "t-fwd", 2);
	await assert.rejects(() => allow(request(null, undefined, { "x-forwarded-for": "7.7.7.7" }), "t-fwd", 2), OverLimit);
});

// ── 2. Bốn đường công khai và /api/tts/vi dùng đúng hạn mức của www ───────────────────────────────────────────────────

const TASHI = "བཀྲ་ཤིས་བདེ་ལེགས།";
const post = (url: string, ip: string, body: unknown) => new Request(url, { method: "POST", headers: { "cf-connecting-ip": ip, "content-type": "application/json" }, body: JSON.stringify(body) });

test("/api/analyze: 60 lần một phút, lần 61 là 429 (không có AI nên không gọi mạng)", async () => {
	mock.method(Date, "now", () => Date.UTC(2026, 10, 23, 10, 0, 30));
	try {
		const { POST } = await import("@/app/api/analyze/route");
		for (let i = 0; i < 60; i++) {
			const response = await POST(post("https://x.test/api/analyze", "10.0.0.1", { text: `${TASHI}${"ཀ".repeat(i + 1)}` }));
			assert.equal(response.status, 200, `lần ${i + 1}`);
		}
		const over = await POST(post("https://x.test/api/analyze", "10.0.0.1", { text: `${TASHI}ཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀཀ` }));
		assert.equal(over.status, 429);
		assert.match(((await over.json()) as { message: string }).message, /đợi một phút/);
		const other = await POST(post("https://x.test/api/analyze", "10.0.0.2", { text: TASHI }));
		assert.equal(other.status, 200, "khách khác không bị vạ lây");
		const bad = await POST(post("https://x.test/api/analyze", "10.0.0.3", { text: "hello" }));
		assert.equal(bad.status, 400, "thiếu chữ Tạng vẫn là 400, không tốn hạn mức");
	} finally {
		mock.restoreAll();
	}
});

test("/api/ask-ai: 20 lần một phút, lần 21 là 429 và có `answer`", async () => {
	mock.method(Date, "now", () => Date.UTC(2026, 10, 23, 10, 5, 30));
	try {
		const { POST } = await import("@/app/api/ask-ai/route");
		for (let i = 0; i < 20; i++) assert.equal((await POST(post("https://x.test/api/ask-ai", "10.0.1.1", { question: `câu hỏi ${i}`, target_text: TASHI }))).status, 200, `lần ${i + 1}`);
		const over = await POST(post("https://x.test/api/ask-ai", "10.0.1.1", { question: "câu hỏi mới", target_text: TASHI }));
		assert.equal(over.status, 429);
		const body = (await over.json()) as { answer: string; message: string };
		assert.match(body.answer, /đợi một phút/, "ô hỏi đáp chỉ hiện `answer`");
		assert.equal((await POST(post("https://x.test/api/ask-ai", "10.0.1.1", { question: "" }))).status, 400);
	} finally {
		mock.restoreAll();
	}
});

test("/api/crop-analyze: 40 lần một phút, lần 41 là 429", async () => {
	mock.method(Date, "now", () => Date.UTC(2026, 10, 23, 10, 10, 30));
	try {
		const { POST } = await import("@/app/api/crop-analyze/route");
		for (let i = 0; i < 40; i++) {
			const response = await POST(post("https://x.test/api/crop-analyze", "10.0.2.1", { fallback_text: `${TASHI}${"ག".repeat(i + 1)}` }));
			assert.equal(response.status, 200, `lần ${i + 1}`);
		}
		const over = await POST(post("https://x.test/api/crop-analyze", "10.0.2.1", { fallback_text: `${TASHI}${"ག".repeat(60)}` }));
		assert.equal(over.status, 429);
	} finally {
		mock.restoreAll();
	}
});

test("/api/tts và /api/tts/vi: quá hạn mức thì 429 trước khi gọi dịch vụ giọng đọc", async () => {
	mock.method(Date, "now", () => Date.UTC(2026, 10, 23, 10, 15, 30));
	const fetchSpy = mock.method(globalThis, "fetch", async () => {
		throw new Error("không được gọi mạng khi đã quá hạn mức");
	});
	try {
		// Dùng hết hạn mức bằng chính bộ đếm (không gọi giọng đọc thật), rồi gọi đường thật.
		for (let i = 0; i < 240; i++) assert.equal(await overLimit(request("10.0.3.1"), "tts", 240), false);
		const { POST } = await import("@/app/api/tts/route");
		const over = await POST(post("https://x.test/api/tts", "10.0.3.1", { text: TASHI }));
		assert.equal(over.status, 429);

		for (let i = 0; i < 60; i++) assert.equal(await overLimit(request("10.0.3.2"), "tts-vi", 60), false);
		const { GET } = await import("@/app/api/tts/vi/route");
		const overVi = await GET(new Request("https://x.test/api/tts/vi?text=xin%20chao", { headers: { "cf-connecting-ip": "10.0.3.2" } }));
		assert.equal(overVi.status, 429);
		assert.equal(fetchSpy.mock.callCount(), 0);
	} finally {
		mock.restoreAll();
	}
});

test("/api/tts/vi: văn bản quá dài bị từ chối ngay (400), không chuyển tiếp sang Google", async () => {
	mock.method(Date, "now", () => Date.UTC(2026, 10, 23, 10, 20, 30));
	const fetchSpy = mock.method(globalThis, "fetch", async () => {
		throw new Error("không được gọi mạng");
	});
	try {
		const { GET } = await import("@/app/api/tts/vi/route");
		const long = encodeURIComponent("a".repeat(601));
		const response = await GET(new Request(`https://x.test/api/tts/vi?text=${long}`, { headers: { "cf-connecting-ip": "10.0.4.1" } }));
		assert.equal(response.status, 400);
		const empty = await GET(new Request("https://x.test/api/tts/vi", { headers: { "cf-connecting-ip": "10.0.4.1" } }));
		assert.equal(empty.status, 400);
		assert.equal(fetchSpy.mock.callCount(), 0);
	} finally {
		mock.restoreAll();
	}
});

test("public/tibetan-study/app.js báo lời 429 ở cả ba chỗ gọi AI, như www", () => {
	const code = read("public/tibetan-study/app.js");
	assert.equal((code.match(/res\.status === 429/g) ?? []).length, 3);
	assert.match(code, /mời đợi một phút rồi thử lại/);
});

test("mọi route công khai gọi mô hình hoặc giọng đọc đều có giới hạn", () => {
	const routes: Record<string, RegExp> = {
		"src/app/api/analyze/route.ts": /allow\(request, "analyze", 60\)/,
		"src/app/api/ask-ai/route.ts": /allow\(request, "ask-ai", 20\)/,
		"src/app/api/crop-analyze/route.ts": /allow\(request, "crop-analyze", 40\)/,
		"src/app/api/tts/route.ts": /overLimit\(request, "tts", 240\)/,
		"src/app/api/tts/vi/route.ts": /overLimit\(req, 'tts-vi', TTS_VI_LIMIT_PER_MINUTE\)/,
	};
	for (const [file, rule] of Object.entries(routes)) assert.match(read(file), rule, file);
});

test("route công khai không trả chi tiết lỗi (câu SQL, tên bảng, địa chỉ nội bộ) ra ngoài", () => {
	for (const file of walk("src/app/api").map(norm).filter((f) => /route\.ts$/.test(f))) {
		assert.doesNotMatch(read(file), /error:\s*(?:\(error as Error\)|error|err)\.message|error:\s*message\b/, file);
	}
});

// ── 3. Bài vị: không còn JSON công khai cả danh sách, và chỉ những trường công khai ────────────────────────────────────

test("không còn /api/memorials và không nơi nào gọi nó", () => {
	assert.equal(existsSync("src/app/api/memorials/route.ts"), false);
	for (const file of sources()) assert.doesNotMatch(read(file), /api\/memorials/, file);
});

test("không còn các route /api/admin thừa trả cả kho bài, giới thiệu, danh tăng, sách tham khảo", () => {
	for (const gone of ["posts", "gioi-thieu", "danh-tang", "reference-books"]) assert.equal(existsSync(`src/app/api/admin/${gone}/route.ts`), false, gone);
});

const full = (extra: Partial<MemorialRecord> = {}): MemorialRecord => ({
	id: "1",
	sheetName: "s",
	category: "Nhà Tứ Ân",
	categorySlug: "nha-tu-an-ca-nhan",
	code: "TA001",
	name: "Nguyễn Văn An",
	gender: "Nam",
	dharmaName: "Thiện Minh",
	lineageType: "Nội tộc",
	birthDate: "01/02/1940",
	deathDate: "03/04/2020",
	age: "80",
	address: "Số 12 Ngõ 5, Yên Thái, Đông Anh, Hà Nội",
	burialLocation: "Nghĩa trang Hữu Bằng, Thạch Thất",
	contactName: "Trần Thị Lan",
	contactPhone: "0912 345 678",
	contact: "Trần Thị Lan 0912345678",
	...extra,
});

test("bản ghi công khai của bài vị chỉ có các trường nhận diện, không có địa chỉ, nơi an táng, người liên hệ, SĐT", () => {
	const record = toPublicMemorialRecord(full());
	assert.deepEqual(Object.keys(record).sort(), ["age", "birthDate", "category", "categorySlug", "code", "deathDate", "dharmaName", "gender", "id", "lineageType", "name"]);
	assert.doesNotMatch(JSON.stringify(record), /Yên Thái|Hữu Bằng|Lan|0912|contact|address|burial/);
	// một trường lạ thêm vào dữ liệu gốc cũng không lọt ra
	assert.equal("secret" in toPublicMemorialRecord({ ...full(), secret: "x" } as MemorialRecord), false);
});

test("tra bài vị: không từ khóa thì không trả gì, từ khóa quá ngắn thì nhờ gõ thêm, không bao giờ trả cả danh sách", () => {
	const records = Array.from({ length: 100 }, (_, i) => full({ id: String(i), code: `TA${i}`, name: `Nguyễn Văn ${i}` }));
	assert.deepEqual(searchMemorialRecords(records, ""), { state: "idle" });
	assert.deepEqual(searchMemorialRecords(records, "   "), { state: "idle" });
	assert.equal(searchMemorialRecords(records, "ng").state, "short");
	assert.equal(searchMemorialRecords(records, "a b").state, "short", `ít hơn ${MEMORIAL_MIN_QUERY} chữ sau khi bỏ khoảng trắng`);
	const found = searchMemorialRecords(records, "nguyen van");
	assert.equal(found.state, "done");
	if (found.state !== "done") return;
	assert.equal(found.total, 100);
	assert.equal(found.records.length, MEMORIAL_MAX_RESULTS);
	assert.ok(MEMORIAL_MAX_RESULTS <= 50);
	assert.doesNotMatch(JSON.stringify(found), /Yên Thái|0912|Hữu Bằng/);
});

test("tra bài vị: lọc theo khu (?khu=) và cắt từ khóa quá dài", () => {
	const records = [full(), full({ id: "2", code: "VSD1", categorySlug: "vang-sinh-duong-nam", name: "Nguyễn Văn Bình" })];
	const vsd = searchMemorialRecords(records, "nguyen", "vang-sinh-duong");
	assert.equal(vsd.state === "done" && vsd.records.map((r) => r.id).join(), "2");
	const long = searchMemorialRecords(records, `nguyen ${"x".repeat(500)}`);
	assert.equal(long.state === "done" || long.state === "short", true);
	if (long.state === "done") assert.ok(long.query.length <= 80);
});

test("tra bài vị trên dữ liệu thật đóng gói: mỗi kết quả không chứa địa chỉ, nơi an táng, tên người liên hệ hay SĐT của chính nó", () => {
	const records = memorialData as MemorialRecord[];
	assert.ok(records.length > 500, "có dữ liệu thật để kiểm");
	let checked = 0;
	for (const rec of records) {
		const json = JSON.stringify(toPublicMemorialRecord(rec));
		for (const secret of [rec.address, rec.burialLocation, rec.contactName, rec.contactPhone, rec.contact]) {
			if (!secret || secret.length < 5 || secret.toUpperCase() === "N/A") continue;
			if (rec.category.includes(secret) || rec.name.includes(secret) || (rec.dharmaName ?? "").includes(secret)) continue;
			assert.equal(json.includes(secret), false, `${rec.id}: lộ "${secret.replace(/\d/g, "9")}"`);
			checked++;
		}
	}
	assert.ok(checked > 1000);
	const hit = searchMemorialRecords(records, "nguyen");
	assert.equal(hit.state, "done");
	if (hit.state === "done") assert.ok(hit.records.length <= MEMORIAL_MAX_RESULTS && hit.total > hit.records.length);
});

test("filterMemorialRecords không khớp được địa chỉ, nơi an táng, người liên hệ hay SĐT (kể cả bản che)", () => {
	const records = [full()];
	for (const query of ["Yên Thái", "Hữu Bằng", "Trần Thị Lan", "0912345678", "0912", "345678"]) assert.deepEqual(filterMemorialRecords(records, query), [], query);
	assert.equal(filterMemorialRecords(records, "Thiện Minh").length, 1);
});

test("trang /tra-cuu-bai-vi tra ở máy chủ, giới hạn lượt tra, không lập chỉ mục, không nhúng cả danh sách", () => {
	const page = read("src/app/(public)/tra-cuu-bai-vi/page.tsx");
	assert.match(page, /robots:\s*\{\s*index:\s*false/);
	assert.match(page, /overLimit\(\{ headers: await headers\(\) \}, 'tra-cuu-bai-vi'/);
	assert.doesNotMatch(page, /getPublicMemorialRecords|initialRecords/);
	const engine = read("src/features/memorial/components/MemorialSearchEngine.tsx");
	assert.doesNotMatch(engine, /fetch\(/, "bộ tra cứu không còn tự tải danh sách");
	assert.doesNotMatch(read("src/features/universe/components/TuAnVangSinhSystem.tsx"), /fetch\(/);
	for (const file of ["src/features/memorial/components/MemorialDetailDialog.tsx", "src/features/memorial/components/MemorialSearchEngine.tsx"]) assert.doesNotMatch(read(file), /\.address|\.burialLocation|\.contactMasked|\.contactName/, file);
});

// ── 4. Công cụ nội bộ ──────────────────────────────────────────────────────────────────────────────────────────────

test("isDevelopment: chỉ development", () => {
	assert.equal(isDevelopment("development"), true);
	for (const env of ["production", "test", "", undefined]) assert.equal(isDevelopment(env), false, String(env));
});

test("/kiem-tra-anh là 404 khi không phải development, và không còn tệp review_statues.html trong public/", async () => {
	assert.equal(existsSync("public/review_statues.html"), false);
	const env = process.env as Record<string, string | undefined>;
	const before = env.NODE_ENV;
	env.NODE_ENV = "production";
	try {
		const { default: Page } = await import("@/app/(public)/kiem-tra-anh/page");
		await assert.rejects(() => Page(), (error: Error) => error.message === "notFound");
	} finally {
		if (before === undefined) delete env.NODE_ENV;
		else env.NODE_ENV = before;
	}
	assert.match(read("src/app/(public)/kiem-tra-anh/page.tsx"), /if \(!isDevelopment\(\)\) notFound\(\)/);
});

// ── 5. Thanh "Trợ lý Phật học" giả ──────────────────────────────────────────────────────────────────────────────────

test("không nơi nào vẽ thanh trợ lý giả SmartSearchAIBar nữa (tệp thành phần còn để làm bản thật sau này)", () => {
	assert.equal(existsSync("src/components/public/SmartSearchAIBar.tsx"), true);
	const allowed = new Set(["src/components/public/SmartSearchAIBar.tsx", "src/components/public/AIChatBox.tsx", "src/components/tong-chi-tu-hoc/chi-tiet/AiQnA.tsx"]);
	for (const file of sources()) {
		if (allowed.has(file)) continue;
		assert.doesNotMatch(read(file), /SmartSearchAIBar|AIChatBox|AiQnA/, file);
	}
});

test("trang chủ không còn mốc neo của thanh trợ lý, và trang khu vực không còn mục HỎI ĐÁP AI", () => {
	assert.doesNotMatch(read("src/app/HomeClient.tsx"), /ai-search|TRỢ LÝ PHẬT HỌC/);
	assert.doesNotMatch(read("src/app/(public)/vu-tru-phat-giao/[slug]/AreaDetailClient.tsx"), /hoi-dap-ai|HỎI ĐÁP AI/);
});

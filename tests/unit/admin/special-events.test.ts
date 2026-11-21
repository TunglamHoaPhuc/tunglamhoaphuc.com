import { describe, expect, it } from "vitest";
import { todayInVietnam } from "../../../src/libs/calendar";
import { lunarDate } from "../../../src/libs/lunar";
import { cleanVerseLine } from "../../../src/admin/special/events";
import { count, specialWorld } from "../helpers/specialWorld";

const EVENT = { title: "Khóa tu Hằng Thuận tháng Mười", startDate: "2026-11-21", endDate: "2026-11-22", categoryId: "event::cong-tu", location: "Giảng Đường", times: [{ label: "Sáng", time: "06:00" }] };

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe("creating and reading events", () => {
	it("makes the slug from the title, fills the lunar date from the start day, and records a revision, the picture usage and the audit entry", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const created = await editor.call("POST", "events", { ...EVENT, imageMediaId: "media-1", status: "published", registrationStatus: "open" });
		expect(created.status).toBe(200);
		const event = created.data;
		expect(event).toMatchObject({ slug: "khoa-tu-hang-thuan-thang-muoi", version: 1, status: "published", registrationStatus: "open", categoryName: "Cộng Tu", imageUrl: "/anh-goc/s2-cnv03/cms/media-1/v1/a1.png" });
		expect(event.lunar).toEqual({ ...lunarDate("2026-11-21"), manual: false });
		const row = w.raw.prepare("SELECT lunar_day, lunar_month, lunar_year, lunar_leap, lunar_manual, registration_open, created_by FROM calendar_event WHERE id = ?").get(event.id);
		expect(row).toMatchObject({ lunar_day: event.lunar.day, lunar_month: event.lunar.month, lunar_manual: 0, registration_open: 1, created_by: "editor" });
		expect(count(w.raw, "revision", `entity_type = 'calendar_event' AND entity_id = '${event.id}' AND version = 1`)).toBe(1);
		expect(count(w.raw, "media_usage", `entity_type = 'calendar_event' AND entity_id = '${event.id}' AND media_id = 'media-1'`)).toBe(1);
		expect(w.raw.prepare("SELECT user_email FROM audit_log WHERE action = 'event.create'").get()).toEqual({ user_email: "editor@example.test" });
	});

	it("defaults to a draft one-day event and ends on the start day when no end is given", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const created = await root.call("POST", "events", { title: "Lễ", startDate: "2026-12-01" });
		expect(created.data).toMatchObject({ status: "draft", endDate: "2026-12-01", registrationStatus: "closed", times: [], categoryId: null });
	});

	it("refuses bad dates, an end before the start, an unknown type, a non-YouTube video and a missing title", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		expect((await root.call("POST", "events", { ...EVENT, startDate: "2026-02-30", endDate: "2026-02-30" })).error.fields.startDate).toBeTruthy();
		expect((await root.call("POST", "events", { ...EVENT, endDate: "2026-11-20" })).error.fields.endDate).toBeTruthy();
		expect((await root.call("POST", "events", { ...EVENT, categoryId: "assembly::chu-phat" })).error.fields.categoryId).toBeTruthy();
		expect((await root.call("POST", "events", { ...EVENT, video: { url: "https://evil.example/watch?v=abc" } })).error.fields.video).toBeTruthy();
		expect((await root.call("POST", "events", { ...EVENT, linkedPostId: "post-khong-co" })).error.fields.linkedPostId).toBeTruthy();
		expect((await root.call("POST", "events", { ...EVENT, imageMediaId: "media-khong-co" })).error.fields.imageMediaId).toBeTruthy();
		expect((await root.call("POST", "events", { ...EVENT, title: "" })).error.fields.title).toBeTruthy();
		expect(count(w.raw, "calendar_event")).toBe(0);
	});

	it("keeps a YouTube address and its id, and links a post", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const created = await root.call("POST", "events", { ...EVENT, video: { url: "https://youtu.be/HE2MnR8Hl5c" }, linkedPostId: "post-1" });
		expect(created.data.video).toEqual({ id: "HE2MnR8Hl5c", url: "https://youtu.be/HE2MnR8Hl5c" });
		expect(created.data.linkedPostId).toBe("post-1");
	});

	it("answers 409 for a slug in use, and lets a trashed event's slug be used again", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const first = await root.call("POST", "events", { ...EVENT, slug: "mot" });
		const clash = await root.call("POST", "events", { ...EVENT, slug: "mot" });
		expect(clash.status).toBe(409);
		expect(clash.error.code).toBe("slug_taken");
		expect((await root.call("DELETE", `events/${first.data.id}`)).status).toBe(204);
		expect((await root.call("POST", "events", { ...EVENT, slug: "mot" })).status).toBe(200);
	});

	it("gives 404 for an unknown or trashed event, and hides trashed events from the list", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "events/khong-co")).status).toBe(404);
		const created = await root.call("POST", "events", EVENT);
		await root.call("DELETE", `events/${created.data.id}`);
		expect((await root.call("GET", `events/${created.data.id}`)).status).toBe(404);
		expect((await root.call("GET", "events")).json.meta.total).toBe(0);
		expect(w.raw.prepare("SELECT deleted_by FROM calendar_event WHERE id = ?").get(created.data.id)).toEqual({ deleted_by: "root" });
		expect((await root.call("DELETE", `events/${created.data.id}`)).status).toBe(404);
	});
});

describe("lunar dates", () => {
	it("GET events/lunar answers the lunar date of a day, and refuses a bad date", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const found = await root.call("GET", "events/lunar?date=2026-02-17");
		expect(found.data).toEqual({ day: 1, month: 1, year: 2026, leap: false });
		expect((await root.call("GET", "events/lunar?date=hom-nay")).status).toBe(400);
		expect((await root.call("GET", "events/lunar")).status).toBe(400);
	});

	it("keeps typed values when lunarManual is on, checks their range, and works the date out again when it is turned off", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const bad = await root.call("POST", "events", { ...EVENT, lunarManual: true, lunar: { day: 31, month: 10, year: 2026, leap: false } });
		expect(bad.status).toBe(400);
		expect((await root.call("POST", "events", { ...EVENT, lunarManual: true, lunar: { day: 5, month: 13, year: 2026, leap: false } })).status).toBe(400);
		expect((await root.call("POST", "events", { ...EVENT, lunarManual: true })).status).toBe(400);
		const manual = await root.call("POST", "events", { ...EVENT, lunarManual: true, lunar: { day: 15, month: 10, year: 2026, leap: true } });
		expect(manual.data.lunar).toEqual({ day: 15, month: 10, year: 2026, leap: true, manual: true });
		// A date change keeps the typed values.
		const moved = await root.call("PATCH", `events/${manual.data.id}`, { version: 1, startDate: "2026-12-05", endDate: "2026-12-05" });
		expect(moved.data.lunar).toMatchObject({ day: 15, month: 10, leap: true, manual: true });
		const auto = await root.call("PATCH", `events/${manual.data.id}`, { version: 2, lunarManual: false });
		expect(auto.data.lunar).toEqual({ ...lunarDate("2026-12-05"), manual: false });
	});

	it("follows the start date when it changes and the date is not manual", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const created = await root.call("POST", "events", EVENT);
		const moved = await root.call("PATCH", `events/${created.data.id}`, { version: 1, startDate: "2027-01-10", endDate: "2027-01-10" });
		expect(moved.data.lunar).toEqual({ ...lunarDate("2027-01-10"), manual: false });
	});
});

describe("changing events", () => {
	it("saves a new version with its revision and an audit entry holding only what changed", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const created = await editor.call("POST", "events", EVENT);
		const updated = await editor.call("PATCH", `events/${created.data.id}`, { version: 1, location: "Đại Hùng Bảo Điện", imageMediaId: "media-2" });
		expect(updated.data).toMatchObject({ version: 2, location: "Đại Hùng Bảo Điện", slug: created.data.slug });
		expect(count(w.raw, "revision", `entity_id = '${created.data.id}'`)).toBe(2);
		const log = w.raw.prepare("SELECT data_before, data_after FROM audit_log WHERE action = 'event.update'").get() as { data_before: string; data_after: string };
		expect(JSON.parse(log.data_before)).toEqual({ location: "Giảng Đường", imageMediaId: null });
		expect(JSON.parse(log.data_after)).toEqual({ location: "Đại Hùng Bảo Điện", imageMediaId: "media-2" });
		expect(count(w.raw, "media_usage", `entity_id = '${created.data.id}' AND media_id = 'media-2'`)).toBe(1);
		// replacing the picture drops the old usage
		await editor.call("PATCH", `events/${created.data.id}`, { version: 2, imageMediaId: null });
		expect(count(w.raw, "media_usage", `entity_id = '${created.data.id}'`)).toBe(0);
	});

	it("answers 409 to a save made on an old version, and changes nothing", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const created = await editor.call("POST", "events", EVENT);
		await editor.call("PATCH", `events/${created.data.id}`, { version: 1, location: "A" });
		const stale = await editor.call("PATCH", `events/${created.data.id}`, { version: 1, location: "B" });
		expect(stale.status).toBe(409);
		expect(stale.error.code).toBe("conflict");
		expect(w.raw.prepare("SELECT location, version FROM calendar_event WHERE id = ?").get(created.data.id)).toEqual({ location: "A", version: 2 });
	});

	it("turns a taken slug into 409 on update, and answers 404 for an unknown event", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		await root.call("POST", "events", { ...EVENT, slug: "mot" });
		const second = await root.call("POST", "events", { ...EVENT, slug: "hai" });
		expect((await root.call("PATCH", `events/${second.data.id}`, { version: 1, slug: "mot" })).error.code).toBe("slug_taken");
		expect((await root.call("PATCH", "events/khong-co", { version: 1, title: "X" })).status).toBe(404);
		expect((await root.call("PATCH", `events/${second.data.id}`, { title: "X" })).status).toBe(400); // version missing
	});

	it("needs the publish right to publish or hide, but not to edit a draft", async () => {
		const w = await specialWorld();
		w.raw.prepare("DELETE FROM role_permission WHERE role_id = 'role-editor' AND module = 'events' AND action = 'publish'").run();
		const editor = await w.as("editor@example.test");
		const draft = await editor.call("POST", "events", EVENT);
		expect(draft.status).toBe(200);
		expect((await editor.call("PATCH", `events/${draft.data.id}`, { version: 1, location: "Mới" })).status).toBe(200);
		expect((await editor.call("PATCH", `events/${draft.data.id}`, { version: 2, status: "published" })).status).toBe(403);
		expect((await editor.call("POST", "events", { ...EVENT, slug: "khac", status: "published" })).status).toBe(403);
		const root = await w.as("root@example.test");
		expect((await root.call("PATCH", `events/${draft.data.id}`, { version: 2, status: "published" })).data.status).toBe("published");
		// a published event cannot be hidden by someone without the right either
		expect((await editor.call("PATCH", `events/${draft.data.id}`, { version: 3, status: "hidden" })).status).toBe(403);
	});

	it("duplicates an event as a draft with its own address, and again with the next address", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const created = await editor.call("POST", "events", { ...EVENT, status: "published", imageMediaId: "media-1" });
		const copy = await editor.call("POST", `events/${created.data.id}/duplicate`);
		expect(copy.data).toMatchObject({ title: `${EVENT.title} (bản sao)`, status: "draft", version: 1, slug: `${created.data.slug}-copy`, imageMediaId: "media-1", startDate: EVENT.startDate });
		expect(copy.data.id).not.toBe(created.data.id);
		const again = await editor.call("POST", `events/${created.data.id}/duplicate`);
		expect(again.data.slug).toBe(`${created.data.slug}-copy-2`);
		expect((await editor.call("POST", "events/khong-co/duplicate")).status).toBe(404);
	});
});

describe("listing events", () => {
	it("filters by month (events that touch it), type and status, in date order", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		await root.call("POST", "events", { title: "Cuối tháng mười", startDate: "2026-10-30", endDate: "2026-11-02", categoryId: "event::cong-tu", status: "published" });
		await root.call("POST", "events", { title: "Giữa tháng", startDate: "2026-11-15", categoryId: "event::khoa-le", status: "draft" });
		await root.call("POST", "events", { title: "Tháng sau", startDate: "2026-12-01", categoryId: "event::cong-tu", status: "published" });
		const names = async (query: string) => (await root.call("GET", `events?${query}`)).data.map((item: { title: string }) => item.title);
		expect(await names("month=2026-11")).toEqual(["Cuối tháng mười", "Giữa tháng"]);
		expect(await names("month=2026-11&category=cong-tu")).toEqual(["Cuối tháng mười"]);
		expect(await names("category=event::khoa-le")).toEqual(["Giữa tháng"]);
		expect(await names("status=published")).toEqual(["Cuối tháng mười", "Tháng sau"]);
		expect(await names("from=2026-12-01")).toEqual(["Tháng sau"]);
		expect(await names("q=giữa")).toEqual(["Giữa tháng"]);
		expect((await root.call("GET", "events?month=2026-13")).status).toBe(400);
		expect((await root.call("GET", "events?pageSize=1&page=2")).data).toHaveLength(1);
	});

	it("GET events/categories lists the event types", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "events/categories")).data.categories.map((item: { slug: string }) => item.slug)).toEqual(["cong-tu", "khoa-le"]);
	});
});

describe("the event the home countdown uses", () => {
	it("is the first published event that begins today or later, by the public page's own rule", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const today = todayInVietnam();
		await root.call("POST", "events", { title: "Đã qua", startDate: addDays(today, -10), status: "published" });
		await root.call("POST", "events", { title: "Nháp sắp tới", startDate: addDays(today, 2), status: "draft" });
		await root.call("POST", "events", { title: "Sắp tới", startDate: addDays(today, 5), status: "published" });
		await root.call("POST", "events", { title: "Xa hơn", startDate: addDays(today, 30), status: "published" });
		expect((await root.call("GET", "events/next")).data.event.title).toBe("Sắp tới");
	});

	it("is null when nothing is coming up", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "events/next")).data.event).toBeNull();
	});
});

describe("who may touch events", () => {
	it("lets an Author read but not write, and an unsigned request in nowhere", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const created = await root.call("POST", "events", EVENT);
		const author = await w.as("author@example.test");
		expect((await author.call("GET", "events")).status).toBe(200);
		expect((await author.call("GET", `events/${created.data.id}`)).status).toBe(200);
		expect((await author.call("POST", "events", EVENT)).status).toBe(403);
		expect((await author.call("PATCH", `events/${created.data.id}`, { version: 1, title: "X" })).status).toBe(403);
		expect((await author.call("DELETE", `events/${created.data.id}`)).status).toBe(403);
		expect((await author.call("POST", `events/${created.data.id}/duplicate`)).status).toBe(403);
		expect((await author.call("PUT", "events/themes/1", { title: "X" })).status).toBe(403);
		expect((await w.client().call("GET", "events")).status).toBe(401);
	});
});

describe("regular programs and month themes", () => {
	it("updates a program's words and picture, refusing a missing one", async () => {
		const w = await specialWorld();
		w.raw.prepare("INSERT INTO featured_program (id, title, time) VALUES ('prog-1', 'Lễ Hằng Thuận', '19:00')").run();
		const editor = await w.as("editor@example.test");
		const result = await editor.call("PATCH", "events/programs/prog-1", { title: "Lễ Hằng Thuận mùng một", time: "19:30", imageMediaId: "media-3" });
		expect(result.data.programs[0]).toMatchObject({ id: "prog-1", title: "Lễ Hằng Thuận mùng một", time: "19:30", imageMediaId: "media-3" });
		expect(count(w.raw, "media_usage", "entity_type = 'featured_program' AND media_id = 'media-3'")).toBe(1);
		expect((await editor.call("PATCH", "events/programs/khong-co", { title: "X" })).status).toBe(404);
		expect((await editor.call("PATCH", "events/programs/prog-1", { imageMediaId: "nope" })).status).toBe(400);
		expect((await editor.call("GET", "events/programs")).data.programs).toHaveLength(1);
	});

	it("keeps only <b> in the verse lines, escapes everything else, and stores the month with its poster", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const saved = await editor.call("PUT", "events/themes/11", { title: "Ân Đức Tổ Thầy", posterMediaId: "media-4", lines: ["Nam mô <b>A Di Đà</b> Phật", "<script>alert(1)</script>", "<b>mở mà không đóng", "  "], author: "Hòa thượng" });
		expect(saved.data).toMatchObject({ month: 11, title: "Ân Đức Tổ Thầy", author: "Hòa thượng", posterMediaId: "media-4" });
		expect(saved.data.lines).toEqual(["Nam mô <b>A Di Đà</b> Phật", "&lt;script&gt;alert(1)&lt;/script&gt;", "<b>mở mà không đóng</b>"]);
		expect(count(w.raw, "media_usage", "entity_type = 'month_theme' AND entity_id = '11'")).toBe(1);
		const all = await editor.call("GET", "events/themes");
		expect(all.data.themes).toHaveLength(12);
		expect(all.data.themes[10].title).toBe("Ân Đức Tổ Thầy");
		expect(all.data.themes[0]).toMatchObject({ month: 1, title: "", lines: [] });
		// a second save replaces, and a partial one keeps the rest
		const again = await editor.call("PUT", "events/themes/11", { author: "Người khác" });
		expect(again.data).toMatchObject({ title: "Ân Đức Tổ Thầy", author: "Người khác" });
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM month_theme").get()).toEqual({ n: 1 });
	});

	it("refuses a month outside 1-12, too many lines and an unknown picture", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PUT", "events/themes/13", { title: "X" })).status).toBe(404);
		expect((await editor.call("PUT", "events/themes/0", { title: "X" })).status).toBe(404);
		expect((await editor.call("PUT", "events/themes/3", { lines: Array.from({ length: 17 }, () => "a") })).status).toBe(400);
		expect((await editor.call("PUT", "events/themes/3", { posterMediaId: "nope" })).status).toBe(400);
	});

	it("cleans a verse line the way the schedule page reads it", () => {
		expect(cleanVerseLine("a & b <i>c</i> <B>d</B>")).toBe("a &amp; b &lt;i&gt;c&lt;/i&gt; <b>d</b>");
		expect(cleanVerseLine("</b>x")).toBe("x");
		expect(cleanVerseLine("<b>a<b>b</b>")).toBe("<b>ab</b>");
	});
});

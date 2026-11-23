// Second security pass, special content: what goes live (quotes active, areas visible, featured areas) needs `publish`,
// and a live item cannot be edited or trashed by someone without `publish`.
import { describe, expect, it } from "vitest";
import { specialWorld } from "../helpers/specialWorld";
import { customAccount } from "../helpers/sec2";

const EVENT = { title: "Khóa tu Hằng Thuận", startDate: "2026-11-21", categoryId: "event::cong-tu" };
const STATUE = { name: "Phật A Di Đà", code: "TP0001", assemblyId: "assembly::chu-phat", areaId: "tam-bao", status: "published" };

describe("public-visibility switches need the publish right", () => {
	it("quotes: creating active, or switching active, needs quotes.publish", async () => {
		const w = await specialWorld();
		const email = customAccount(w.raw, "q", ["quotes.view", "quotes.create", "quotes.update"]);
		const publisher = customAccount(w.raw, "qp", ["quotes.view", "quotes.create", "quotes.update", "quotes.publish"]);
		const q = await w.as(email);
		const p = await w.as(publisher);
		expect((await q.call("POST", "quotes", { text: "Nội dung tự lên trang", active: true })).status).toBe(403);
		const plain = await q.call("POST", "quotes", { text: "Chưa nêu trạng thái" });
		expect(plain.status).toBe(200);
		expect(plain.data.active).toBe(false); // without the right the default is off, not on
		expect((await q.call("POST", "quotes", { text: "Tắt sẵn", active: false })).status).toBe(200);
		expect((await q.call("PATCH", `quotes/${plain.data.id}`, { active: true })).status).toBe(403);
		expect((await q.call("PATCH", `quotes/${plain.data.id}`, { text: "Sửa chữ, vẫn tắt", active: false })).status).toBe(200);
		expect((await p.call("PATCH", `quotes/${plain.data.id}`, { active: true })).data.active).toBe(true);
		expect((await p.call("POST", "quotes", { text: "Có quyền xuất bản" })).data.active).toBe(true); // the old default for those who may
	});

	it("areas: switching visible needs areas.publish", async () => {
		const w = await specialWorld();
		const q = await w.as(customAccount(w.raw, "a", ["areas.view", "areas.update"]));
		const p = await w.as(customAccount(w.raw, "ap", ["areas.view", "areas.update", "areas.publish"]));
		const area = (id: string) => w.raw.prepare("SELECT version, visible FROM area WHERE id = ?").get(id) as { version: number; visible: number };
		w.raw.prepare("UPDATE area SET visible = 0 WHERE id = 'tam-bao'").run();
		expect((await q.call("PATCH", "areas/tam-bao", { version: area("tam-bao").version, visible: true })).status).toBe(403);
		expect((await q.call("PATCH", "areas/tam-bao", { version: area("tam-bao").version, visible: false, subtitle: "Phụ đề" })).status).toBe(200);
		expect((await p.call("PATCH", "areas/tam-bao", { version: area("tam-bao").version, visible: true })).data.visible).toBe(true);
	});

	it("featured areas go live at once: they need home.publish (the publish right of the home page in the docs)", async () => {
		const w = await specialWorld();
		const q = await w.as(customAccount(w.raw, "f", ["areas.view", "areas.update", "home.view", "home.update"]));
		const areaPublisher = await w.as(customAccount(w.raw, "fp", ["areas.view", "areas.update", "areas.publish"]));
		const p = await w.as(customAccount(w.raw, "fh", ["areas.view", "areas.update", "home.view", "home.update", "home.publish"]));
		expect((await q.call("PUT", "areas/featured", { ids: ["tam-bao"] })).status).toBe(403);
		expect((await areaPublisher.call("PUT", "areas/featured", { ids: ["tam-bao"] })).status).toBe(403);
		expect((w.raw.prepare("SELECT COUNT(*) AS n FROM area WHERE featured = 1").get() as { n: number }).n).toBe(0);
		expect((await p.call("PUT", "areas/featured", { ids: ["tam-bao"] })).status).toBe(200);
	});
});

describe("a live item needs the publish right to be edited or trashed", () => {
	it("events, programs and month themes", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const live = await root.call("POST", "events", { ...EVENT, status: "published" });
		const draft = await root.call("POST", "events", { ...EVENT, title: "Bản nháp", status: "draft" });
		w.raw.prepare("INSERT INTO featured_program (id, title, time) VALUES ('prog-1', 'Lễ', '19:00')").run();
		const e = await w.as(customAccount(w.raw, "e", ["events.view", "events.update", "events.delete"]));
		const p = await w.as(customAccount(w.raw, "ep", ["events.view", "events.update", "events.delete", "events.publish"]));
		for (const [method, path, body] of [
			["PATCH", `events/${live.data.id}`, { version: 1, location: "Chỗ khác" }],
			["DELETE", `events/${live.data.id}`, undefined],
			["PATCH", "events/programs/prog-1", { title: "Đổi" }],
			["PUT", "events/themes/3", { title: "Đổi" }],
		] as const) {
			const refused = await e.call(method, path, body);
			expect([method, path, refused.status, refused.error?.code]).toEqual([method, path, 403, "needs_publisher"]);
		}
		expect((await e.call("PATCH", `events/${draft.data.id}`, { version: 1, location: "Chỗ khác" })).status).toBe(200);
		expect((await e.call("DELETE", `events/${draft.data.id}`)).status).toBe(204);
		expect((await p.call("PATCH", `events/${live.data.id}`, { version: 1, location: "Chỗ khác" })).status).toBe(200);
		expect((await p.call("PATCH", "events/programs/prog-1", { title: "Đổi" })).status).toBe(200);
		expect((await p.call("PUT", "events/themes/3", { title: "Đổi" })).status).toBe(200);
		expect((await p.call("DELETE", `events/${live.data.id}`)).status).toBe(204);
	});

	it("update:own does not let an author change their own published event", async () => {
		const w = await specialWorld();
		const own = await w.as(customAccount(w.raw, "o", ["events.view", "events.create", "events.update:own", "events.delete:own"]));
		const mine = await own.call("POST", "events", { ...EVENT, status: "draft" });
		expect(mine.status).toBe(200);
		w.raw.prepare("UPDATE calendar_event SET status = 'published' WHERE id = ?").run(mine.data.id); // an editor published it
		const refused = await own.call("PATCH", `events/${mine.data.id}`, { version: 1, location: "Tự sửa" });
		expect([refused.status, refused.error.code]).toEqual([403, "needs_publisher"]);
		expect((await own.call("DELETE", `events/${mine.data.id}`)).error.code).toBe("needs_publisher");
	});

	it("statues (core, related), areas and quotes", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const statue = await root.call("POST", "statues", STATUE);
		const draftStatue = await root.call("POST", "statues", { name: "Bản nháp", code: "TP0002", status: "draft" });
		const quote = await root.call("POST", "quotes", { text: "Đang hiện", active: true });
		const quietQuote = await root.call("POST", "quotes", { text: "Đang tắt", active: false });
		w.raw.prepare("UPDATE area SET visible = 1 WHERE id = 'tam-bao'").run();
		w.raw.prepare("UPDATE area SET visible = 0 WHERE id = 'to-duong'").run();
		const mods = ["statues", "areas", "quotes"];
		const perms = (m: string) => [`${m}.view`, `${m}.update`, `${m}.delete`];
		const s = await w.as(customAccount(w.raw, "s", mods.flatMap(perms)));
		const sp = await w.as(customAccount(w.raw, "sp", [...mods.flatMap(perms), ...mods.map((m) => `${m}.publish`)]));
		const code = (r: { error?: { code: string } }) => r.error?.code;

		expect(code(await s.call("PATCH", `statues/${statue.data.id}`, { version: 1, subtitle: "x" }))).toBe("needs_publisher");
		expect(code(await s.call("PUT", `statues/${statue.data.id}/related`, { version: 1, related: [] }))).toBe("needs_publisher");
		expect(code(await s.call("DELETE", `statues/${statue.data.id}`))).toBe("needs_publisher");
		expect((await s.call("PATCH", `statues/${draftStatue.data.id}`, { version: 1, subtitle: "x" })).status).toBe(200);

		expect(code(await s.call("PATCH", "areas/tam-bao", { version: 1, subtitle: "x" }))).toBe("needs_publisher");
		expect(code(await s.call("DELETE", "areas/tam-bao"))).toBe("needs_publisher");
		expect((await s.call("PATCH", "areas/to-duong", { version: 1, subtitle: "x" })).status).toBe(200);

		expect(code(await s.call("PATCH", `quotes/${quote.data.id}`, { text: "Sửa" }))).toBe("needs_publisher");
		expect(code(await s.call("DELETE", `quotes/${quote.data.id}`))).toBe("needs_publisher");
		expect((await s.call("PATCH", `quotes/${quietQuote.data.id}`, { text: "Sửa" })).status).toBe(200);

		expect((await sp.call("PATCH", `statues/${statue.data.id}`, { version: 1, subtitle: "x" })).status).toBe(200);
		expect((await sp.call("PATCH", "areas/tam-bao", { version: 1, subtitle: "x" })).status).toBe(200);
		expect((await sp.call("PATCH", `quotes/${quote.data.id}`, { text: "Sửa" })).status).toBe(200);
		expect((await sp.call("DELETE", `quotes/${quote.data.id}`)).status).toBe(204);
		expect((await sp.call("DELETE", "areas/tam-bao")).status).toBe(204);
		expect((await sp.call("DELETE", `statues/${statue.data.id}`)).status).toBe(204);
	});
});

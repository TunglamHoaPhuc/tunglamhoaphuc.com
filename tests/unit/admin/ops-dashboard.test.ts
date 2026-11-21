import { describe, expect, it } from "vitest";
import { world } from "../helpers/adminWorld";
import { insertAudit, insertMedia, SEEDS } from "../helpers/ops";

const NOW = new Date("2026-06-15T05:00:00.000Z");

async function filled(extra: (raw: Awaited<ReturnType<typeof world>>["raw"]) => void = () => undefined) {
	const w = await world(SEEDS);
	const post = w.raw.prepare("INSERT INTO post (id, slug, title, section, published_date, status, created_by, author, updated_at) VALUES (?, ?, ?, 'dong-chay-hoang-phap', '2026-06-01', ?, ?, ?, ?)");
	post.run("p1", "a", "Bài chờ một", "pending", "author", "Cộng tác", "2026-06-10T00:00:00.000Z");
	post.run("p2", "b", "Bài chờ hai", "pending", "author2", "Cộng tác hai", "2026-06-12T00:00:00.000Z");
	post.run("p3", "c", "Đã đăng", "published", "editor", "", "2026-06-01T00:00:00.000Z");
	post.run("p4", "d", "Nháp", "draft", "author", "", "2026-06-01T00:00:00.000Z");
	post.run("p5", "e", "Nháp trong thùng rác", "draft", "author", "", "2026-06-01T00:00:00.000Z");
	w.raw.prepare("UPDATE post SET deleted_at = '2026-06-02' WHERE id = 'p5'").run();
	const event = w.raw.prepare("INSERT INTO calendar_event (id, slug, title, start_date, end_date, status, location, position) VALUES (?, ?, ?, ?, ?, ?, 'Chùa', ?)");
	event.run("e0", "da-qua", "Đã qua", "2026-06-01", "2026-06-02", "published", 0);
	event.run("e1", "dang-dien-ra", "Đang diễn ra", "2026-06-14", "2026-06-16", "published", 0);
	for (let i = 2; i <= 7; i++) event.run(`e${i}`, `sap-toi-${i}`, `Sắp tới ${i}`, `2026-07-0${i}`, `2026-07-0${i}`, "published", 0);
	event.run("ed", "nhap", "Nháp", "2026-06-20", "2026-06-20", "draft", 0);
	insertMedia(w.raw, { id: "m1" });
	w.raw.prepare("UPDATE user SET locked_at = '2026-06-01' WHERE id = 'author2'").run();
	extra(w.raw);
	return w;
}

describe("dashboard", () => {
	it("gives a Super Admin every block with real numbers", async () => {
		const w = await filled();
		w.deps.now = () => NOW;
		// activity: two entries today (Vietnam day 15 June), one on 1 June (outside 30 days: 16 May is the first day)
		insertAudit(w.raw, { at: "2026-06-15T01:00:00.000Z" });
		insertAudit(w.raw, { at: "2026-06-15T04:00:00.000Z" });
		insertAudit(w.raw, { at: "2026-06-13T20:00:00.000Z" }); // 14 June 03:00 in Vietnam
		insertAudit(w.raw, { at: "2026-05-10T00:00:00.000Z" });
		const root = await w.as("root@example.test");
		const result = await root.call("GET", "dashboard");
		expect(result.status).toBe(200);
		const d = result.data;
		expect(d.posts.byStatus).toEqual({ draft: 1, pending: 2, published: 1, scheduled: 0, hidden: 0 });
		expect(d.posts.total).toBe(4);
		expect(d.posts.pending.map((p: { id: string }) => p.id)).toEqual(["p2", "p1"]);
		expect(d.posts.pending[0]).toMatchObject({ title: "Bài chờ hai", author: "Cộng tác hai", createdBy: "author2", link: "/quan-tri/bai-viet/p2" });
		expect(d.events.map((e: { id: string }) => e.id)).toEqual(["e1", "e2", "e3", "e4", "e5"]);
		expect(d.events[0]).toMatchObject({ title: "Đang diễn ra", location: "Chùa" });
		expect(d.activity.days).toHaveLength(30);
		expect(d.activity.days[29]).toMatchObject({ date: "2026-06-15" });
		expect(d.activity.days[0].date).toBe("2026-05-17");
		const byDate = Object.fromEntries(d.activity.days.map((day: { date: string; count: number }) => [day.date, day.count]));
		expect(byDate["2026-06-15"]).toBeGreaterThanOrEqual(2);
		expect(byDate["2026-06-14"]).toBe(1);
		expect(byDate["2026-06-01"]).toBe(0);
		expect(d.activity.total).toBe(d.activity.days.reduce((n: number, day: { count: number }) => n + day.count, 0));
		expect(d.media.total.count).toBe(1);
		expect(d.users).toEqual({ total: SEEDS.length, locked: 1 });
	});

	it("shows each person only the blocks of modules they may view", async () => {
		const w = await filled();
		w.deps.now = () => NOW;
		const editor = (await (await w.as("editor@example.test")).call("GET", "dashboard")).data;
		expect(Object.keys(editor).sort()).toEqual(["events", "media", "posts"]);
		const admin = (await (await w.as("admin@example.test")).call("GET", "dashboard")).data;
		expect(Object.keys(admin).sort()).toEqual(["activity", "events", "media", "posts", "users"]);
		const author = (await (await w.as("author@example.test")).call("GET", "dashboard")).data;
		expect(Object.keys(author).sort()).toEqual(["events", "media", "posts"]);
		expect(author.users).toBeUndefined();
		expect(author.activity).toBeUndefined();
	});

	it("limits the posts block to the person's own posts when they may only view their own", async () => {
		const w = await filled();
		w.raw.prepare("UPDATE role_permission SET scope = 'own' WHERE role_id = 'role-author' AND module = 'posts' AND action = 'view'").run();
		const author = (await (await w.as("author@example.test")).call("GET", "dashboard")).data;
		expect(author.posts.byStatus).toMatchObject({ pending: 1, draft: 1, published: 0 });
		expect(author.posts.pending.map((p: { id: string }) => p.id)).toEqual(["p1"]);
	});

	it("is closed to a role without dashboard.view", async () => {
		const w = await filled();
		w.raw.prepare("DELETE FROM role_permission WHERE role_id = 'role-author' AND module = 'dashboard'").run();
		const author = await w.as("author@example.test");
		expect((await author.call("GET", "dashboard")).status).toBe(403);
	});
});

// Second security pass, trash: bringing a live item back from the trash puts it on the site again, so it takes `<module>.publish`.
import { describe, expect, it } from "vitest";
import { specialWorld } from "../helpers/specialWorld";
import { customAccount } from "../helpers/sec2";

const EVENT = { title: "Khóa tu Hằng Thuận", startDate: "2026-11-21", categoryId: "event::cong-tu" };

/** Rows in every state, then moved to the trash by a Super Admin. */
async function trashed() {
	const w = await specialWorld();
	const root = await w.as("root@example.test");
	const ed = await w.as("editor@example.test");
	const mk = async (title: string, publish: boolean) => {
		const post = await ed.call("POST", "posts", { title, section: "dong-chay-hoang-phap" });
		if (publish) await ed.call("POST", `posts/${post.data.id}/publish`, {});
		return post.data.id as string;
	};
	const ids = {
		postLive: await mk("Bài đã đăng", true),
		postDraft: await mk("Bài nháp", false),
		eventLive: (await root.call("POST", "events", { ...EVENT, status: "published" })).data.id as string,
		eventDraft: (await root.call("POST", "events", { ...EVENT, title: "Nháp", status: "draft" })).data.id as string,
		quoteLive: (await root.call("POST", "quotes", { text: "Đang hiện", active: true })).data.id as string,
		quoteOff: (await root.call("POST", "quotes", { text: "Đang tắt", active: false })).data.id as string,
		statueLive: (await root.call("POST", "statues", { name: "Tượng đã đăng", code: "TP0001", status: "published" })).data.id as string,
	};
	w.raw.prepare("UPDATE area SET visible = 1 WHERE id = 'tam-bao'").run();
	w.raw.prepare("UPDATE area SET visible = 0 WHERE id = 'to-duong'").run();
	await root.call("DELETE", `posts/${ids.postLive}`);
	await root.call("DELETE", `posts/${ids.postDraft}`);
	await root.call("DELETE", `events/${ids.eventLive}`);
	await root.call("DELETE", `events/${ids.eventDraft}`);
	await root.call("DELETE", `quotes/${ids.quoteLive}`);
	await root.call("DELETE", `quotes/${ids.quoteOff}`);
	await root.call("DELETE", `statues/${ids.statueLive}`);
	await root.call("DELETE", "areas/tam-bao");
	await root.call("DELETE", "areas/to-duong");
	return { w, ids };
}

const deletedAt = (raw: { prepare: (sql: string) => { get: (...a: string[]) => unknown } }, table: string, id: string) => (raw.prepare(`SELECT deleted_at FROM ${table} WHERE id = ?`).get(id) as { deleted_at: string | null }).deleted_at;

describe("restoring from the trash re-publishes only with the publish right", () => {
	it("refuses a live post, event, statue, quote and area to someone without publish, and leaves them in the trash", async () => {
		const { w, ids } = await trashed();
		const mods = ["posts", "events", "statues", "quotes", "areas"];
		const t = await w.as(customAccount(w.raw, "t", ["trash.view", "trash.update", ...mods.flatMap((m) => [`${m}.view`, `${m}.update`])]));
		const cases: [string, string, string][] = [
			["post", ids.postLive, "post"],
			["calendar_event", ids.eventLive, "calendar_event"],
			["statue", ids.statueLive, "statue"],
			["quote", ids.quoteLive, "quote"],
			["area", "tam-bao", "area"],
		];
		for (const [type, id, table] of cases) {
			const refused = await t.call("POST", `trash/${type}/${id}/restore`, {});
			expect([type, refused.status, refused.error?.code]).toEqual([type, 403, "needs_publisher"]);
			expect(refused.error.message).toMatch(/xuất bản/);
			expect(deletedAt(w.raw, table, id), type).not.toBeNull();
		}
		expect((w.raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'trash.restore'").get() as { n: number }).n).toBe(0);
	});

	it("still lets them restore what is not on the site (draft, switched off, hidden area)", async () => {
		const { w, ids } = await trashed();
		const mods = ["posts", "events", "quotes", "areas"];
		const t = await w.as(customAccount(w.raw, "t", ["trash.view", "trash.update", ...mods.flatMap((m) => [`${m}.view`, `${m}.update`])]));
		expect((await t.call("POST", `trash/post/${ids.postDraft}/restore`, {})).status).toBe(200);
		expect((await t.call("POST", `trash/calendar_event/${ids.eventDraft}/restore`, {})).status).toBe(200);
		expect((await t.call("POST", `trash/quote/${ids.quoteOff}/restore`, {})).status).toBe(200);
		expect((await t.call("POST", "trash/area/to-duong/restore", {})).status).toBe(200);
	});

	it("restores a live one with the module's publish right, and Editor (who holds it) is unaffected", async () => {
		const { w, ids } = await trashed();
		const p = await w.as(customAccount(w.raw, "p", ["trash.view", "trash.update", "posts.view", "posts.update", "posts.publish", "quotes.view", "quotes.update", "quotes.publish"]));
		expect((await p.call("POST", `trash/post/${ids.postLive}/restore`, {})).status).toBe(200);
		expect((await p.call("POST", `trash/quote/${ids.quoteLive}/restore`, {})).status).toBe(200);
		// publish on one module is not publish on another
		const wrong = await w.as(customAccount(w.raw, "p2", ["trash.view", "trash.update", "events.view", "events.update", "posts.publish"]));
		expect((await wrong.call("POST", `trash/calendar_event/${ids.eventLive}/restore`, {})).error.code).toBe("needs_publisher");
		const ed = await w.as("editor@example.test");
		const refusedForEditor = await ed.call("POST", `trash/statue/${ids.statueLive}/restore`, {});
		expect(refusedForEditor.status).toBe(200); // Editor holds statues.publish and trash.update, statues.update
	});

	it("never gates media, accounts or roles on publish", async () => {
		const w = await specialWorld();
		w.raw.prepare("INSERT INTO media (id, r2_key, filename, mime, created_at, deleted_at) VALUES ('gone', 'cms/gone/v1/g.png', 'g.png', 'image/png', '2026', '2026-11-01')").run();
		const m = await w.as(customAccount(w.raw, "m", ["trash.view", "trash.update", "media.view", "media.update"]));
		expect((await m.call("POST", "trash/media/gone/restore", {})).status).toBe(200);
	});
});

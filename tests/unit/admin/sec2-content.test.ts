// Second security pass, articles: pinning is a publishing decision (it moves an article to the top of the public lists).
import { describe, expect, it } from "vitest";
import { contentWorld } from "../helpers/contentWorld";

const POST = { title: "Bài của cộng tác", section: "dong-chay-hoang-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu" };

describe("pinning an article needs the publish right", () => {
	it("refuses an Author who creates a pinned draft, or pins an own draft, and accepts the same from an Editor", async () => {
		const w = await contentWorld();
		const author = await w.as("author@example.test");
		const editor = await w.as("editor@example.test");
		const refusedCreate = await author.call("POST", "posts", { ...POST, pinned: true });
		expect([refusedCreate.status, refusedCreate.error.code]).toEqual([403, "needs_publisher"]);
		expect(refusedCreate.error.message).toMatch(/[Gg]him/);

		const own = await author.call("POST", "posts", { ...POST, pinned: false });
		expect(own.status).toBe(200);
		const refusedPin = await author.call("PATCH", `posts/${own.data.id}`, { version: own.data.version, pinned: true });
		expect([refusedPin.status, refusedPin.error.code]).toEqual([403, "needs_publisher"]);
		expect((w.raw.prepare("SELECT pinned FROM post WHERE id = ?").get(own.data.id) as { pinned: number }).pinned).toBe(0);

		// editing other fields, with pinned left or sent unchanged, still works for the Author
		const edited = await author.call("PATCH", `posts/${own.data.id}`, { version: own.data.version, title: "Sửa tiêu đề", pinned: false });
		expect(edited.status).toBe(200);

		const created = await editor.call("POST", "posts", { ...POST, title: "Của biên tập", pinned: true });
		expect(created.status).toBe(200);
		expect(created.data.pinned).toBe(true);
		const pinned = await editor.call("PATCH", `posts/${own.data.id}`, { version: edited.data.version, pinned: true });
		expect(pinned.status).toBe(200);
		expect(pinned.data.pinned).toBe(true);
	});

	it("lets an Author keep editing a draft an Editor pinned, but not unpin it", async () => {
		const w = await contentWorld();
		const author = await w.as("author@example.test");
		const editor = await w.as("editor@example.test");
		const own = await author.call("POST", "posts", POST);
		const pinned = await editor.call("PATCH", `posts/${own.data.id}`, { version: own.data.version, pinned: true });
		const fine = await author.call("PATCH", `posts/${own.data.id}`, { version: pinned.data.version, title: "Tác giả sửa chữ", pinned: true });
		expect(fine.status).toBe(200);
		expect((await author.call("PATCH", `posts/${own.data.id}`, { version: fine.data.version, pinned: false })).status).toBe(403);
	});
});

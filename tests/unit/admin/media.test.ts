import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { sniffImage } from "../../../src/admin/media/files";
import { PASSWORD, world, type Seed } from "../helpers/adminWorld";

const SEEDS: Seed[] = [
	{ id: "root", email: "root@example.test", roleId: "role-super-admin" },
	{ id: "editor", email: "editor@example.test", roleId: "role-editor" },
	{ id: "author", email: "author@example.test", roleId: "role-author" },
	{ id: "author2", email: "author2@example.test", roleId: "role-author" },
];

/** A real picture of the given size and kind; `seed` makes two pictures differ. */
async function picture(width: number, height: number, kind: "png" | "jpeg" | "webp" | "gif" = "png", seed = 1): Promise<Uint8Array> {
	const base = sharp({ create: { width, height, channels: 3, background: { r: seed * 7 % 255, g: 90, b: 40 } } });
	const buffer = kind === "png" ? await base.png().toBuffer() : kind === "jpeg" ? await base.jpeg().toBuffer() : kind === "webp" ? await base.webp().toBuffer() : await base.gif().toBuffer();
	return new Uint8Array(buffer);
}

describe("telling pictures from other files", () => {
	it("reads the kind and size of JPEG, PNG, WebP and GIF from their bytes", async () => {
		for (const kind of ["png", "jpeg", "webp", "gif"] as const) {
			const found = sniffImage(await picture(120, 80, kind));
			expect(found, kind).toMatchObject({ width: 120, height: 80 });
			expect(found?.mime).toBe(kind === "jpeg" ? "image/jpeg" : `image/${kind}`);
		}
	});

	it("refuses SVG, text, a cut-off file and a lie about the type", async () => {
		const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>'.padEnd(64, " "));
		expect(sniffImage(svg)).toBeNull();
		expect(sniffImage(new TextEncoder().encode("hello".repeat(20)))).toBeNull();
		expect(sniffImage((await picture(50, 50)).slice(0, 20))).toBeNull();
		expect(sniffImage(new Uint8Array(100))).toBeNull();
	});
});

describe("uploading", () => {
	it("stores the file in R2 under cms/<id>/v1/, records it with its real size, and logs it", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const bytes = await picture(640, 360);
		const up = await editor.form("POST", "media", { bytes, name: "Lễ Hằng Thuận 2026.png" }, { alt: "Lễ Hằng Thuận", title: "Lễ" });
		expect(up.status).toBe(200);
		const item = up.data;
		expect(item).toMatchObject({ width: 640, height: 360, version: 1, alt: "Lễ Hằng Thuận", source: "cms", mime: "image/png", sizeBytes: bytes.length });
		expect(item.url).toBe(`/anh-goc/s2-cnv03/cms/${item.id}/v1/le-hang-thuan-2026.png`);
		expect(item.thumbUrl).toContain("/cdn-cgi/image/width=360");
		expect([...w.files.keys()]).toEqual([`cms/${item.id}/v1/le-hang-thuan-2026.png`]);
		expect(w.files.get(`cms/${item.id}/v1/le-hang-thuan-2026.png`)?.type).toBe("image/png");
		const log = w.raw.prepare("SELECT user_email, entity_id FROM audit_log WHERE action = 'media.upload'").get() as { user_email: string; entity_id: string };
		expect(log).toEqual({ user_email: "editor@example.test", entity_id: item.id });
	});

	it("trusts the bytes, not the name or type: a script named .png is refused, and so is SVG", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const html = new TextEncoder().encode("<script>alert(1)</script>".padEnd(64, " "));
		expect((await editor.form("POST", "media", { bytes: html, name: "x.png" })).error.code).toBe("unsupported_file");
		const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'.padEnd(80, " "));
		expect((await editor.form("POST", "media", { bytes: svg, name: "x.svg" })).status).toBe(415);
		expect(w.files.size).toBe(0);
	});

	it("refuses a file over 15 MB, a request with no file, and a non-multipart request", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		expect((await editor.form("POST", "media", { bytes: new Uint8Array(15 * 1024 * 1024 + 10), name: "big.png" })).error.code).toBe("too_large");
		expect((await editor.form("POST", "media", null)).error.fields.file).toBeTruthy();
		expect((await editor.call("POST", "media", { a: 1 })).error.code).toBe("multipart_required");
	});

	it("spots the same picture uploaded twice, unless asked to keep both", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const bytes = await picture(300, 200, "png", 3);
		const first = await editor.form("POST", "media", { bytes, name: "a.png" });
		const again = await editor.form("POST", "media", { bytes, name: "b.png" });
		expect(again.status).toBe(409);
		expect(again.error.code).toBe("duplicate");
		expect(again.error.fields.id).toBe(first.data.id);
		expect((await editor.form("POST", "media", { bytes, name: "b.png" }, { allowDuplicate: "1" })).status).toBe(200);
	});

	it("cleans up the file if the database refuses the record", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const bad = await editor.form("POST", "media", { bytes: await picture(100, 100), name: "a.png" }, { folderId: "khong-co" });
		expect(bad.status).toBe(400);
		expect(w.files.size).toBe(0);
	});

	it("is for people with the right: an account without media rights gets 403", async () => {
		const w = await world([...SEEDS, { id: "nobody", email: "nobody@example.test", roleId: "role-author" }]);
		w.raw.prepare("DELETE FROM role_permission WHERE role_id = 'role-author' AND module = 'media'").run();
		const nobody = await w.as("nobody@example.test");
		expect((await nobody.form("POST", "media", { bytes: await picture(100, 100), name: "a.png" })).status).toBe(403);
		expect((await nobody.call("GET", "media")).status).toBe(403);
	});
});

describe("whose pictures a person may change", () => {
	it("lets an Author upload and edit their own, not someone else's, and not delete at all", async () => {
		const w = await world(SEEDS);
		const a1 = await w.as("author@example.test");
		const a2 = await w.as("author2@example.test");
		const mine = (await a1.form("POST", "media", { bytes: await picture(100, 100, "png", 1), name: "m.png" })).data;
		const theirs = (await a2.form("POST", "media", { bytes: await picture(100, 100, "png", 2), name: "t.png" })).data;
		expect((await a1.call("PATCH", `media/${mine.id}`, { alt: "của tôi" })).data.alt).toBe("của tôi");
		expect((await a1.call("PATCH", `media/${theirs.id}`, { alt: "x" })).status).toBe(403);
		expect((await a1.form("PUT", `media/${theirs.id}/file`, { bytes: await picture(100, 100, "png", 9), name: "z.png" })).status).toBe(403);
		expect((await a1.call("DELETE", `media/${mine.id}`)).status).toBe(403);
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PATCH", `media/${theirs.id}`, { alt: "biên tập sửa" })).status).toBe(200);
	});
});

describe("replacing a picture in place", () => {
	it("keeps the id, makes a new version and address, removes the old file and the crops", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const first = (await editor.form("POST", "media", { bytes: await picture(800, 450), name: "bia.png" })).data;
		await editor.form("PUT", `media/${first.id}/crops/16%3A9`, { bytes: await picture(320, 180, "png", 5), name: "c.png" }, { region: JSON.stringify({ x: 0, y: 0, width: 100, height: 100 }) });
		w.raw.prepare("INSERT INTO media_usage (media_id, entity_type, entity_id, field) VALUES (?, 'post', 'p1', 'banner')").run(first.id);
		expect(w.files.size).toBe(2);

		const next = await editor.form("PUT", `media/${first.id}/file`, { bytes: await picture(1200, 675, "jpeg", 4), name: "bia-moi.jpg" });
		expect(next.status).toBe(200);
		expect(next.data).toMatchObject({ id: first.id, version: 2, width: 1200, height: 675, mime: "image/jpeg", usageCount: 1 });
		expect(next.data.url).not.toBe(first.url);
		expect(next.data.url).toContain(`/cms/${first.id}/v2/`);
		expect([...w.files.keys()]).toEqual([`cms/${first.id}/v2/bia-moi.jpg`]);
		expect((await editor.call("GET", `media/${first.id}`)).data.crops).toEqual([]);
		// the place that uses it still points at the same id
		expect((w.raw.prepare("SELECT media_id FROM media_usage").get() as { media_id: string }).media_id).toBe(first.id);
		const log = w.raw.prepare("SELECT data_before, data_after FROM audit_log WHERE action = 'media.replace'").get() as { data_before: string; data_after: string };
		expect(JSON.parse(log.data_before).version).toBe(1);
		expect(JSON.parse(log.data_after).version).toBe(2);
	});

	it("refuses a bad new file and leaves the old picture alone; and a picture still on WordPress", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const first = (await editor.form("POST", "media", { bytes: await picture(100, 100), name: "a.png" })).data;
		const bad = await editor.form("PUT", `media/${first.id}/file`, { bytes: new TextEncoder().encode("khong phai anh".padEnd(64)), name: "a.png" });
		expect(bad.status).toBe(415);
		expect((await editor.call("GET", `media/${first.id}`)).data).toMatchObject({ version: 1, url: first.url });
		expect(w.files.size).toBe(1);

		w.raw.prepare("INSERT INTO media (id, url, filename, created_at) VALUES ('wp1', 'https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/01/a.jpg', 'a.jpg', '2026-01-01')").run();
		expect((await editor.form("PUT", "media/wp1/file", { bytes: await picture(100, 100, "png", 6), name: "a.png" })).error.code).toBe("not_replaceable");
	});
});

describe("cropping for the frame shapes", () => {
	async function withPicture() {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const item = (await editor.form("POST", "media", { bytes: await picture(1600, 900), name: "to.png" })).data;
		return { w, editor, item };
	}
	const region = JSON.stringify({ x: 10, y: 5, width: 50, height: 60 });

	it("saves a crop whose shape matches, replaces it on a second save, and lists and deletes it", async () => {
		const { w, editor, item } = await withPicture();
		const saved = await editor.form("PUT", `media/${item.id}/crops/4%3A3`, { bytes: await picture(400, 300, "webp", 2), name: "c.webp" }, { region });
		expect(saved.status).toBe(200);
		expect(saved.data.crops).toHaveLength(1);
		expect(saved.data.crops[0]).toMatchObject({ ratio: "4:3", x: 10, y: 5, width: 50, height: 60 });
		const firstUrl = saved.data.crops[0].url as string;
		expect(firstUrl).toMatch(new RegExp(`^/anh-goc/s2-cnv03/cms/${item.id}/v1/crop-4x3-[a-z0-9]+\.webp$`));
		const keyOf = (url: string) => url.replace("/anh-goc/s2-cnv03/", "");
		expect(w.files.has(keyOf(firstUrl))).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 5));
		const again = await editor.form("PUT", `media/${item.id}/crops/4%3A3`, { bytes: await picture(800, 600, "webp", 3), name: "c.webp" }, { region });
		expect(again.data.crops).toHaveLength(1);
		// cut again: a new address (no cache can hold the old cut) and the old file is gone
		const secondUrl = again.data.crops[0].url as string;
		expect(secondUrl).not.toBe(firstUrl);
		expect(w.files.has(keyOf(firstUrl))).toBe(false);
		expect(w.files.has(keyOf(secondUrl))).toBe(true);
		expect((await editor.call("DELETE", `media/${item.id}/crops/4%3A3`)).status).toBe(204);
		expect(w.files.has(keyOf(secondUrl))).toBe(false);
		expect((await editor.call("DELETE", `media/${item.id}/crops/4%3A3`)).status).toBe(404);
	});

	it("refuses an unknown shape, a crop of the wrong shape, and a region outside the picture", async () => {
		const { editor, item } = await withPicture();
		const crop = (ratio: string, w: number, h: number, r = region) => picture(w, h, "png", 8).then((bytes) => editor.form("PUT", `media/${item.id}/crops/${encodeURIComponent(ratio)}`, { bytes, name: "c.png" }, { region: r }));
		expect((await crop("5:4", 500, 400)).error.fields.ratio).toBeTruthy();
		expect((await crop("16:9", 400, 300)).error.fields.file).toBeTruthy();
		expect((await crop("1:1", 300, 300, JSON.stringify({ x: 80, y: 0, width: 50, height: 50 }))).error.fields.region).toBeTruthy();
		expect((await crop("1:1", 300, 300, "not json")).error.fields.region).toBeTruthy();
		expect((await crop("1:1", 300, 300)).status).toBe(200);
		expect((await crop("16:10", 320, 200)).status).toBe(200);
		expect((await crop("3:4", 300, 400)).status).toBe(200);
	});
});

describe("deleting", () => {
	it("moves an unused picture to the trash: out of the list, still in R2 for a restore", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const item = (await editor.form("POST", "media", { bytes: await picture(100, 100), name: "a.png" })).data;
		expect((await editor.call("DELETE", `media/${item.id}`)).status).toBe(204);
		expect((await editor.call("GET", `media/${item.id}`)).status).toBe(404);
		expect((await editor.call("GET", "media")).json.meta.total).toBe(0);
		expect(w.files.size).toBe(1);
		const row = w.raw.prepare("SELECT deleted_by FROM media WHERE id = ?").get(item.id) as { deleted_by: string };
		expect(row.deleted_by).toBe("editor");
	});

	it("refuses a picture that is in use, telling where, unless forced by someone with the right", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const item = (await editor.form("POST", "media", { bytes: await picture(100, 100), name: "a.png" })).data;
		w.raw.prepare("INSERT INTO media_usage (media_id, entity_type, entity_id, field) VALUES (?, 'post', 'p1', 'banner'), (?, 'area', 'a1', 'cover')").run(item.id, item.id);
		const refused = await editor.call("DELETE", `media/${item.id}`);
		expect(refused.status).toBe(409);
		expect(refused.error.code).toBe("in_use");
		expect(refused.error.message).toContain("2 chỗ");
		const detail = await editor.call("GET", `media/${item.id}`);
		expect(detail.data.usage).toEqual([
			{ entityType: "area", entityId: "a1", field: "cover" },
			{ entityType: "post", entityId: "p1", field: "banner" },
		]);
		expect((await editor.call("DELETE", `media/${item.id}?force=1`)).status).toBe(204);
	});
});

describe("folders", () => {
	it("makes a tree three levels deep, refuses duplicates and a fourth level, and keeps pictures in them", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const a = (await editor.call("POST", "media/folders", { name: "Khóa tu 2026" })).data;
		expect(a.slug).toBe("khoa-tu-2026");
		const b = (await editor.call("POST", "media/folders", { name: "Tháng 11", parentId: a.id })).data;
		const c = (await editor.call("POST", "media/folders", { name: "Ảnh bìa", parentId: b.id })).data;
		expect((await editor.call("POST", "media/folders", { name: "Quá sâu", parentId: c.id })).error.code).toBe("too_deep");
		expect((await editor.call("POST", "media/folders", { name: "khóa tu 2026" })).error.code).toBe("name_taken");
		expect((await editor.call("POST", "media/folders", { name: "!!!" })).status).toBe(400);

		const item = (await editor.form("POST", "media", { bytes: await picture(100, 100), name: "a.png" }, { folderId: c.id })).data;
		await editor.form("POST", "media", { bytes: await picture(100, 100, "png", 5), name: "b.png" });
		const folders = (await editor.call("GET", "media/folders")).data;
		expect(folders.folders.find((f: { id: string }) => f.id === c.id).count).toBe(1);
		expect(folders.noFolder).toBe(1);
		expect((await editor.call("GET", `media?folderId=${c.id}`)).json.meta.total).toBe(1);
		expect((await editor.call("GET", "media?folderId=none")).json.meta.total).toBe(1);

		expect((await editor.call("DELETE", `media/folders/${c.id}`)).error.code).toBe("folder_not_empty");
		expect((await editor.call("DELETE", `media/folders/${b.id}`)).error.code).toBe("folder_not_empty");
		await editor.call("PATCH", `media/${item.id}`, { folderId: null });
		expect((await editor.call("DELETE", `media/folders/${c.id}`)).status).toBe(204);
	});

	it("renames and moves a folder, but not into itself or its child", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const a = (await editor.call("POST", "media/folders", { name: "A" })).data;
		const b = (await editor.call("POST", "media/folders", { name: "B", parentId: a.id })).data;
		expect((await editor.call("PATCH", `media/folders/${a.id}`, { parentId: b.id })).error.code).toBe("invalid_input");
		expect((await editor.call("PATCH", `media/folders/${a.id}`, { parentId: a.id })).error.code).toBe("invalid_input");
		expect((await editor.call("PATCH", `media/folders/${b.id}`, { name: "B2", parentId: null })).status).toBe(204);
		const list = (await editor.call("GET", "media/folders")).data.folders;
		expect(list.find((f: { id: string }) => f.id === b.id)).toMatchObject({ name: "B2", parentId: null, slug: "b2" });
	});
});

describe("finding pictures and counting them", () => {
	it("searches name, title and alt, sorts, pages, and shows pictures nobody uses", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const ids: string[] = [];
		for (const [i, name] of ["pho-hien.png", "chua-xua.png", "thap-bao.png"].entries()) {
			ids.push((await editor.form("POST", "media", { bytes: await picture(100 + i, 100, "png", i + 10), name }, { alt: i === 2 ? "Tháp Bảo Tháp" : "" })).data.id);
		}
		w.raw.prepare("INSERT INTO media_usage (media_id, entity_type, entity_id, field) VALUES (?, 'post', 'p1', 'banner')").run(ids[0]);
		expect((await editor.call("GET", "media?q=chua")).json.meta.total).toBe(1);
		expect((await editor.call("GET", "media?q=Bảo")).json.meta.total).toBe(1); // matches alt
		expect((await editor.call("GET", "media?q=%25")).json.meta.total).toBe(0);
		const unused = await editor.call("GET", "media?unused=1");
		expect(unused.json.meta.total).toBe(2);
		expect(unused.data.map((m: { id: string }) => m.id)).not.toContain(ids[0]);
		expect((await editor.call("GET", "media?sort=name")).data.map((m: { filename: string }) => m.filename)).toEqual(["chua-xua.png", "pho-hien.png", "thap-bao.png"]);
		const paged = await editor.call("GET", "media?pageSize=2&page=2");
		expect(paged.json.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
		expect(paged.data).toHaveLength(1);
		expect((await editor.call("GET", `media?q=${encodeURIComponent("x'; DROP TABLE media;--")}`)).status).toBe(200);
		expect((await editor.call("GET", "media")).json.meta.total).toBe(3);
	});

	it("lists what came from the old admin as imported, with no size when unknown, and counts storage", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		w.raw.prepare("INSERT INTO media (id, r2_key, filename, size_bytes, created_at) VALUES ('old1', 'tunglamhoa/x/a.jpg', 'a.jpg', 5000, '2025-05-01'), ('old2', 'tunglamhoa/x/b.jpg', 'b.jpg', NULL, NULL)").run();
		await editor.form("POST", "media", { bytes: await picture(100, 100), name: "m.png" });
		const list = (await editor.call("GET", "media")).data;
		const old = list.find((m: { id: string }) => m.id === "old1");
		expect(old).toMatchObject({ source: "imported", url: "/anh-goc/s2-cnv03/tunglamhoa/x/a.jpg", sizeBytes: 5000 });
		expect(list.find((m: { id: string }) => m.id === "old2").sizeBytes).toBeNull();
		const stats = (await editor.call("GET", "media/stats")).data;
		expect(stats.total.count).toBe(3);
		expect(stats.total.withoutSize).toBe(1);
		expect(stats.library.count).toBe(1);
		expect(stats.unused.count).toBe(3);
		expect(stats.byYear.map((y: { year: string }) => y.year)).toContain("2025");
		expect(stats.byYear.map((y: { year: string }) => y.year)).toContain("Không rõ");
	});
});

describe("the update form", () => {
	it("changes alt, title, caption and folder, logging what changed, and says nothing when nothing changed", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const item = (await editor.form("POST", "media", { bytes: await picture(100, 100), name: "a.png" })).data;
		const changed = await editor.call("PATCH", `media/${item.id}`, { alt: "Mô tả", title: "Tiêu đề", caption: "Chú thích" });
		expect(changed.data).toMatchObject({ alt: "Mô tả", title: "Tiêu đề", caption: "Chú thích" });
		const before = (w.raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'media.update'").get() as { n: number }).n;
		await editor.call("PATCH", `media/${item.id}`, { alt: "Mô tả" });
		expect((w.raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'media.update'").get() as { n: number }).n).toBe(before);
		expect((await editor.call("PATCH", `media/${item.id}`, { folderId: "khong-co" })).status).toBe(400);
		expect((await editor.call("PATCH", "media/khong-co", { alt: "x" })).status).toBe(404);
		void PASSWORD;
	});
});

// T42d: the id of a `media` row must not depend on how the site draws a picture's address.
// D1 was filled on 17/11/2026, when pictures still came out of mediaUrl() as their B2 or
// WordPress address; T42c then made them /anh-goc/… and every id changed, so `--merge` wanted to
// add 21 thousand rows for pictures D1 already holds. The id is now the sha1 of the address the
// file had on 17/11 (the "stored address"), whatever form the source gives it in.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildStatements, mediaRowId } from "../../src/db/import";
import { storedMediaAddress } from "../../src/libs/content/media";
import { applyMigrations, applyStatements, openDatabase } from "../../src/db/nodeSqlite";
import { content, post } from "./helpers/importContent";

/** The id D1 holds, worked out here from the address written out in full (the frozen formula). */
const frozen = (address: string) => createHash("sha1").update(address).digest("hex").slice(0, 20);

const S3 = "https://s2-cnv03.s3.us-east-005.backblazeb2.com";
const WP = "https://admin.tunglamhoaphuc.com/wp-content/uploads";

describe("the stored address of a picture", () => {
	it("is the B2 address of the key, whichever form the source gives", () => {
		const key = "tunglamhoaphuc2/04-vu-tru-phat-giao/toan-canh-chua.webp";
		for (const src of [`${S3}/${key}`, `https://b1.congngheviet.com.vn/file/s2-cnv03/${key}`, `https://f005.backblazeb2.com/file/s2-cnv03/${key}`, `/anh-goc/s2-cnv03/${key}`]) {
			expect(storedMediaAddress(src)).toBe(`${S3}/${key}`);
			expect(mediaRowId(src)).toBe(frozen(`${S3}/${key}`));
		}
	});

	it("is the WordPress address for every form of a WordPress upload", () => {
		for (const src of [`${WP}/2026/10/65.jfif`, "https://www.tunglamhoaphuc.com/wp-content/uploads/2026/10/65.jfif", "https://tunglamhoaphuc.com/wp-content/uploads/2026/10/65.jfif", "/anh-goc/wordpress/2026/10/65.jfif"]) {
			expect(storedMediaAddress(src)).toBe(`${WP}/2026/10/65.jfif`);
			expect(mediaRowId(src)).toBe(frozen(`${WP}/2026/10/65.jfif`));
		}
	});

	it("is the B2 address of the second bucket", () => {
		const address = "https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/abc/x.jpg";
		expect(storedMediaAddress(address)).toBe(address);
		expect(storedMediaAddress("/anh-goc/media-tunglamhoaphuc/abc/x.jpg")).toBe(address);
		expect(mediaRowId("/anh-goc/media-tunglamhoaphuc/abc/x.jpg")).toBe(frozen(address));
	});

	it("keeps files that are not pictures, other hosts and the site's own paths as they are", () => {
		expect(storedMediaAddress(`${S3}/a/bai-giang.mp3`)).toBe(`${S3}/a/bai-giang.mp3`);
		expect(storedMediaAddress("https://example.com/a/b.jpg")).toBe("https://example.com/a/b.jpg");
		expect(mediaRowId("https://example.com/a/b.jpg")).toBe(frozen("https://example.com/a/b.jpg"));
		expect(storedMediaAddress("/brand/logo.webp")).toBe("/brand/logo.webp");
		expect(storedMediaAddress("")).toBeNull();
		expect(mediaRowId(null)).toBeNull();
	});

	it("gives another picture another id", () => {
		const ids = new Set([`${S3}/a/1.jpg`, `${S3}/a/2.jpg`, `${WP}/2026/10/1.jpg`, "https://example.com/1.jpg"].map((src) => mediaRowId(src)));
		expect(ids.size).toBe(4);
	});
});

describe("the media rows the import writes", () => {
	it("carry the ids D1 holds, and the key or address D1 holds", () => {
		const data = content({
			posts: [post("1", { thumbnail: { src: "/anh-goc/s2-cnv03/a/thumb.webp", position: "50% 50%" }, banner: { src: `${WP}/2026/10/65.jfif`, position: "50% 50%" } })],
		});
		const db = openDatabase();
		applyMigrations(db);
		applyStatements(db, buildStatements(data).statements);
		const rows = db.prepare("select id, r2_key, url from media order by id").all() as { id: string; r2_key: string | null; url: string | null }[];
		const byId = new Map(rows.map((row) => [row.id, row]));
		expect(byId.get(frozen(`${S3}/a/thumb.webp`))).toMatchObject({ r2_key: "a/thumb.webp", url: null });
		expect(byId.get(frozen(`${WP}/2026/10/65.jfif`))).toMatchObject({ r2_key: null, url: `${WP}/2026/10/65.jfif` });
	});
});

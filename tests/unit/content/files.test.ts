import { describe, expect, it, vi } from "vitest";
import { createFileLoaders, type ReadFile, type SourceFile } from "@/libs/content/sources/files";

const post = (id: number) => ({ id: `p${id}`, slug: `bai-${id}`, title: `Bài ${id}`, mainCategory: "dong-chay-hoang-phap", subCategory: "cong-tu", categoryName: "Cộng Tu", publishedDate: "2026-10-01", status: "published" });

/** A source whose files can be changed between reads, counting the reads. */
function source(files: Record<string, SourceFile | null>) {
	const reads: string[] = [];
	const read: ReadFile = async (name) => {
		reads.push(name);
		return files[name] ?? null;
	};
	return { files, reads, read };
}

describe("file loaders", () => {
	it("turn a file into content once per version", async () => {
		const parse = vi.fn();
		const src = source({ posts: { version: "v1", data: [post(1), post(2)] } });
		const loaders = createFileLoaders(src.read, { error: parse });
		const first = await loaders.posts();
		expect(first.map((item) => item.id)).toEqual(["p1", "p2"]);
		expect(await loaders.posts()).toBe(first);
		src.files.posts = { version: "v2", data: [post(3)] };
		expect((await loaders.posts()).map((item) => item.id)).toEqual(["p3"]);
		expect(src.reads).toEqual(["posts", "posts", "posts"]);
	});

	it("keep the last content when a new version has none left, and say so", async () => {
		const log = { error: vi.fn() };
		const src = source({ posts: { version: "v1", data: [post(1)] } });
		const loaders = createFileLoaders(src.read, log);
		await loaders.posts();
		src.files.posts = { version: "v2", data: { broken: true } };
		expect((await loaders.posts()).map((item) => item.id)).toEqual(["p1"]);
		expect(log.error).toHaveBeenCalledWith(expect.stringContaining("posts"));
	});

	it("give empty content for a file that is not there", async () => {
		const loaders = createFileLoaders(source({}).read);
		expect(await loaders.posts()).toEqual([]);
		expect(await loaders.statues()).toEqual([]);
		expect((await loaders.albums()).size).toBe(0);
		expect((await loaders.schedule()).events).toEqual([]);
	});
});

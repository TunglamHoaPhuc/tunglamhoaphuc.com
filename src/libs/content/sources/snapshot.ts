/// <reference types="vite/client" />
// Source "snapshot": the old admin's JSON files copied into data/snapshot/ (not in git).
// Bundled at build time; a missing file just means no content, never a failed build.
import { type ParsedPosts, parsePosts, toGallery } from "../posts";
import { rawPostSchema } from "../schema";
import type { GalleryImage } from "../types";

// As text, parsed here: Vite's JSON loader rejects the half emoji ("\ud83d") one post
// ends with, which JSON.parse accepts.
const files = import.meta.glob<string>("/data/snapshot/*.json", { query: "?raw", import: "default" });

/** The parsed file, or `null` when data/snapshot/<name>.json is not there. */
export async function readSnapshotFile(name: string): Promise<unknown> {
	const load = files[`/data/snapshot/${name}.json`];
	return load ? JSON.parse(await load()) : null;
}

export async function loadSnapshotPosts(): Promise<ParsedPosts> {
	const file = await readSnapshotFile("posts");
	return file === null ? { posts: [], issues: [], total: 0 } : parsePosts(file);
}

const albumSchema = rawPostSchema.shape.photoGallery;

/**
 * post-albums.json (`npm run snapshot:fetch -- --albums`): the albums the old admin's lists
 * leave empty, by post id. Only post pages need them, so they load on the first such page.
 */
export async function loadSnapshotAlbums(): Promise<Map<string, GalleryImage[]>> {
	const file = await readSnapshotFile("post-albums");
	const albums = new Map<string, GalleryImage[]>();
	if (!file || typeof file !== "object") return albums;
	for (const [id, photos] of Object.entries(file)) {
		const { gallery } = toGallery(albumSchema.parse(photos));
		if (gallery.length) albums.set(id, gallery);
	}
	return albums;
}

/// <reference types="vite/client" />
// Source "snapshot": the old admin's JSON files copied into data/snapshot/ (not in git).
// Bundled at build time; a missing file just means no content, never a failed build.
import { type ParsedPosts, parsePosts } from "../posts";

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

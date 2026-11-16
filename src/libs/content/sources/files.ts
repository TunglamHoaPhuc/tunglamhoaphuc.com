// The old admin's files, whichever source they come from: copied into the build (snapshot)
// or read from the bucket the old admin writes (b2). A source only reads one file by name;
// these loaders turn the files into content for the repository. A file is turned into
// content again only when its version changes, and a new version left with nothing in it
// (a file cut short, a format the adapters no longer know) does not wipe the site out.
import { parseAbout } from "../about";
import { parseStatues, type StatueEntry } from "../baoTuong";
import { parsePosts, toGallery } from "../posts";
import { parseSchedule } from "../schedule";
import { rawPostSchema } from "../schema";
import { parseTongChi, type TongChiEntry } from "../tongChi";
import type { AboutTopic, Area, GalleryImage, Post, Schedule } from "../types";
import { parseAreas } from "../vuTru";

/** A file as a source gives it: its parsed JSON, and a version that changes with it (the ETag on B2). */
export type SourceFile = { version: string; data: unknown };
/** One file by name ("posts" for posts.json); `null` when the source has no such file. */
export type ReadFile = (name: string) => Promise<SourceFile | null>;

type Log = Pick<Console, "error">;

const albumSchema = rawPostSchema.shape.photoGallery;

/** post-albums.json: the albums the old admin's lists leave empty, by post id. */
function albumsFrom(file: unknown): Map<string, GalleryImage[]> {
	const albums = new Map<string, GalleryImage[]>();
	if (!file || typeof file !== "object") return albums;
	for (const [id, photos] of Object.entries(file)) {
		const { gallery } = toGallery(albumSchema.parse(photos));
		if (gallery.length) albums.set(id, gallery);
	}
	return albums;
}

const scheduleSize = (schedule: Schedule) => schedule.events.length + schedule.programs.length + schedule.themes.length;

export type FileLoaders = {
	posts(): Promise<Post[]>;
	albums(): Promise<Map<string, GalleryImage[]>>;
	schedule(): Promise<Schedule>;
	about(): Promise<AboutTopic[]>;
	tongChi(): Promise<TongChiEntry[]>;
	areas(): Promise<Area[]>;
	statues(): Promise<StatueEntry[]>;
};

export function createFileLoaders(read: ReadFile, log: Log = console): FileLoaders {
	const kept = new Map<string, { version: string; value: unknown }>();

	async function load<T>(name: string, parse: (data: unknown) => T, size: (value: T) => number): Promise<T> {
		const file = await read(name);
		const version = file?.version ?? "";
		const old = kept.get(name) as { version: string; value: T } | undefined;
		if (old && old.version === version) return old.value;
		const value = parse(file ? file.data : null);
		if (old && size(value) === 0 && size(old.value) > 0) {
			log.error(`[nội dung] ${name}: bản ${version || "trống"} không còn mục nào; giữ bản ${old.version}`);
			return old.value;
		}
		kept.set(name, { version, value });
		return value;
	}

	return {
		posts: () => load("posts", (data) => (data === null ? [] : parsePosts(data).posts), (posts) => posts.length),
		albums: () => load("post-albums", albumsFrom, (albums) => albums.size),
		schedule: () => load("schedule", (data) => parseSchedule(data ?? {}).schedule, scheduleSize),
		about: () => load("gioi-thieu", (data) => parseAbout(data ?? []).topics, (topics) => topics.length),
		tongChi: () => load("tong-chi", (data) => parseTongChi(data ?? []).entries, (entries) => entries.length),
		areas: () => load("vu-tru", (data) => parseAreas(data ?? []).areas, (areas) => areas.length),
		statues: () => load("bao-tuong", (data) => parseStatues(data ?? []).statues, (statues) => statues.length),
	};
}

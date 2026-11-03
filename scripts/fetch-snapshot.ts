// npm run snapshot:fetch: a stopgap data/snapshot/posts.json until the old admin's files
// are copied from B2 (tasks/plan.md, chuẩn bị #1) or read with a read-only key (T19).
//
// It calls only the GET endpoints the public site itself calls from visitors' browsers:
// the list once per section, since the unfiltered list leaves out the albums of about 500
// posts. The file keeps the API's shape ({ success, total, posts }) and the old site's order.
//
// With --albums it also asks the detail endpoint, a few at a time, for the albums the lists
// still leave empty, and writes them to data/snapshot/post-albums.json ({ [post id]: photos }).
//
// The schedule (lịch tu học: events, regular ceremonies, month themes, quotes) comes from
// the endpoint the old home page reads, into data/snapshot/schedule.json as the API sends it;
// the Giới thiệu topics into data/snapshot/gioi-thieu.json the same way.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ORIGIN = "https://www.tunglamhoaphuc.com";
const SECTIONS = ["dong-chay-hoang-phap", "tri-tue-phat-phap", "vu-tru-phat-giao"];
const OUT = "data/snapshot/posts.json";
const ALBUMS_OUT = "data/snapshot/post-albums.json";
const SCHEDULE_OUT = "data/snapshot/schedule.json";
const ABOUT_OUT = "data/snapshot/gioi-thieu.json";
const AT_ONCE = 3;

type RawPost = { id: string; slug: string; galleryCount?: number; photoGallery?: unknown[] };

async function get<T>(path: string): Promise<T> {
	const response = await fetch(`${ORIGIN}${path}`, { headers: { accept: "application/json" } });
	if (!response.ok) throw new Error(`${response.status} ${response.statusText} cho ${path}`);
	return (await response.json()) as T;
}

async function fetchPosts(): Promise<RawPost[]> {
	const order = (await get<{ posts: RawPost[] }>("/api/admin/posts")).posts.map((post) => post.id);
	const byId = new Map<string, RawPost>();
	for (const section of SECTIONS) {
		for (const post of (await get<{ posts: RawPost[] }>(`/api/admin/posts?category=${section}`)).posts) byId.set(post.id, post);
	}
	const missing = order.filter((id) => !byId.has(id));
	if (missing.length) throw new Error(`Có bài không thuộc chuyên mục nào: ${missing.join(", ")}`);
	const posts = order.map((id) => byId.get(id)!);
	mkdirSync("data/snapshot", { recursive: true });
	writeFileSync(OUT, JSON.stringify({ success: true, total: posts.length, posts }));
	console.log(`${OUT}: ${posts.length} bài, lấy từ ${ORIGIN} lúc ${new Date().toISOString()}`);
	return posts;
}

async function fetchAlbums(posts: RawPost[]) {
	// The detail endpoint answers by slug, so a post whose slug another post owns is skipped.
	const owners = new Map<string, string>();
	for (const post of posts) if (!owners.has(post.slug)) owners.set(post.slug, post.id);
	const wanted = posts.filter((post) => !post.photoGallery?.length && post.galleryCount && owners.get(post.slug) === post.id);
	const albums: Record<string, unknown[]> = existsSync(ALBUMS_OUT) ? JSON.parse(readFileSync(ALBUMS_OUT, "utf8")) : {};
	const queue = wanted.filter((post) => !albums[post.id]?.length);
	let done = 0;
	let failed = 0;
	const worker = async () => {
		for (let post = queue.shift(); post; post = queue.shift()) {
			try {
				// A few slugs are stored already percent-encoded (emoji), so encode only the others.
				const path = post.slug.includes("%") ? post.slug : encodeURIComponent(post.slug);
				const { post: detail } = await get<{ post: RawPost }>(`/api/admin/posts/${path}`);
				if (detail?.id === post.id && detail.photoGallery?.length) albums[post.id] = detail.photoGallery;
			} catch (error) {
				failed++;
				console.warn(`  ${post.id}: ${(error as Error).message}`);
			}
			if (++done % 50 === 0) console.log(`  ${done}/${wanted.length}…`);
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
	};
	await Promise.all(Array.from({ length: AT_ONCE }, worker));
	writeFileSync(ALBUMS_OUT, JSON.stringify(albums));
	const photos = Object.values(albums).reduce((sum, list) => sum + list.length, 0);
	console.log(`${ALBUMS_OUT}: album của ${Object.keys(albums).length}/${wanted.length} bài (${photos} ảnh), ${failed} lỗi`);
}

async function fetchSchedule() {
	const file = await get<{ data?: { customEvents?: unknown[] } }>("/api/admin/schedule");
	writeFileSync(SCHEDULE_OUT, JSON.stringify(file));
	console.log(`${SCHEDULE_OUT}: ${file.data?.customEvents?.length ?? 0} sự kiện`);
}

async function fetchAbout() {
	const file = await get<{ topics?: unknown[] }>("/api/admin/gioi-thieu");
	writeFileSync(ABOUT_OUT, JSON.stringify(file));
	console.log(`${ABOUT_OUT}: ${file.topics?.length ?? 0} chủ đề`);
}

const posts = await fetchPosts();
await fetchSchedule();
await fetchAbout();
if (process.argv.includes("--albums")) await fetchAlbums(posts);

// npm run snapshot:fetch: a stopgap data/snapshot/posts.json until the old admin's files
// are copied from B2 (tasks/plan.md, chuẩn bị #1) or read with a read-only key (T19).
//
// It calls only the GET lists the public site itself calls from visitors' browsers, one
// per section, since the unfiltered list leaves out the albums of about 500 posts. The file
// keeps the API's shape ({ success, total, posts }) and the old site's order.
import { mkdirSync, writeFileSync } from "node:fs";

const ORIGIN = "https://www.tunglamhoaphuc.com";
const SECTIONS = ["dong-chay-hoang-phap", "tri-tue-phat-phap", "vu-tru-phat-giao"];
const OUT = "data/snapshot/posts.json";

async function list(query = ""): Promise<{ id: string }[]> {
	const response = await fetch(`${ORIGIN}/api/admin/posts${query}`, { headers: { accept: "application/json" } });
	if (!response.ok) throw new Error(`${response.status} ${response.statusText} cho /api/admin/posts${query}`);
	return ((await response.json()) as { posts: { id: string }[] }).posts;
}

const order = (await list()).map((post) => post.id);
const byId = new Map<string, { id: string }>();
for (const section of SECTIONS) for (const post of await list(`?category=${section}`)) byId.set(post.id, post);

const missing = order.filter((id) => !byId.has(id));
if (missing.length) throw new Error(`Có bài không thuộc chuyên mục nào: ${missing.join(", ")}`);

const posts = order.map((id) => byId.get(id)!);
mkdirSync("data/snapshot", { recursive: true });
writeFileSync(OUT, JSON.stringify({ success: true, total: posts.length, posts }));
console.log(`${OUT}: ${posts.length} bài, lấy từ ${ORIGIN} lúc ${new Date().toISOString()}`);

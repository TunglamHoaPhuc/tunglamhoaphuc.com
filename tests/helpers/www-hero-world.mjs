// Cho CHÍNH mã dựng trang chủ của www (src/libs/home.ts: loadHomeData) dựng các khung đầu trang trên đúng dữ liệu mà kiểm thử
// tests/unit/v3-home-hero-www-parity.test.ts đưa vào, rồi ghi kết quả ra JSON để V3 so với khung của mình.
//
// Chạy trong một tiến trình riêng bằng tsx của www (mã của www dùng đường dẫn `@/…` mà `node --test` của V3 không hiểu), giống www-calendar-world.mjs:
//   TSX_TSCONFIG_PATH=<www>/tsconfig.json node <www>/node_modules/tsx/dist/cli.mjs <tệp này> <www> <vao.json> <ra.json>
// Không import gì của V3, không chạm Cloudflare hay D1: kho nội dung nằm trong bộ nhớ.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [, , WWW, IN_JSON, OUT_JSON] = process.argv;
if (!WWW || !IN_JSON || !OUT_JSON) throw new Error("thiếu tham số: <www> <vao.json> <ra.json>");
process.chdir(WWW);
const load = (rel) => import(pathToFileURL(`${WWW}/${rel}`).href);

const { loadHomeData } = await load("src/libs/home.ts");
const { createMemoryRepository } = await load("src/libs/content/repository.ts");

const { scenarios } = JSON.parse(readFileSync(IN_JSON, "utf8"));
const out = {};
for (const scenario of scenarios) {
	const repo = createMemoryRepository(scenario.posts, { loadSchedule: async () => ({ events: scenario.events, programs: [], themes: [], quotes: [] }) });
	const data = await loadHomeData(repo, new Date(scenario.now), { settings: scenario.settings, quotes: [], media: {} });
	out[scenario.name] = data.hero.map(({ id, overline, title, subtitle, text, link }) => ({ id, overline: overline ?? "", title, subtitle: subtitle ?? "", text, link }));
}
writeFileSync(OUT_JSON, JSON.stringify(out));

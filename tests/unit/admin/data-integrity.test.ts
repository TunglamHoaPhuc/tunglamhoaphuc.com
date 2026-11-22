// DATA INTEGRITY on the real data (tasks/admin-v3-spec.md "Kiểm thử": Dữ liệu). data/snapshot (the old site's export, not in git) is
// imported into an in-memory database the way the owner's D1 was, and the real admin API (the same router the Worker runs) is driven
// over all of it:
//  1. every post, Tông Chỉ article and Giới thiệu page: opening it and saving "as it is" (the editor's no-change payload, which is
//     `{version}`, and the full payload of every loaded value) changes nothing, writes no revision and no redirect, and keeps the version;
//  2. the first real edit of a sample (all 80 posts whose slug is longer than 80 characters, every tenth of the others, all Tông Chỉ
//     and Giới thiệu) leaves exactly the versions [N, N+1]; restoring N gives the import back byte for byte;
//  3. nothing is left dangling afterwards (foreign keys, revisions, usage rows, related rows, redirects);
//  4. the public reader (the d1 source) shows the edit and hides what is a draft, hidden, scheduled for later or in the trash;
//  5. the number of rows per table is what it was, except what the test made itself.
import { beforeAll, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { parseSafe, serialize } from "../../../src/admin/content/html";
import { KINDS, type Kind } from "../../../src/admin/content/kinds";
import { asD1 } from "../../../src/db/nodeSqlite";
import { createD1Repository } from "../../../src/libs/content/sources/d1";
import { HAS_SNAPSHOT, importedWorld } from "../helpers/importedWorld";

type Raw = Record<string, unknown>;
type World = Awaited<ReturnType<typeof importedWorld>>;
type Client = Awaited<ReturnType<World["as"]>>;

const TABLES = [
	["post", KINDS.posts],
	["teaching_article", KINDS.teachings],
	["page", KINDS.pages],
] as const;
const KEYS = (kind: Kind) => [...kind.fields.map((spec) => spec.key), "slug", ...(kind.hasSection ? ["section"] : []), "categoryId", "contentHtml", "contentJson", ...(kind.hasExtra ? ["extra"] : []), ...(kind.hasMilestones ? ["milestones"] : [])];
/** Columns a save legitimately moves (who and when), and the search index, which is derived from the text and not content. */
const BOOKKEEPING = new Set(["version", "updated_at", "updated_by", "search_text"]);

/** The page text in the form the public side finally shows (its own cleaning applied): the converted brief and the saved HTML meet there. */
const asShown = (html: string | undefined) => serialize(parseSafe(html ?? ""));

const rowsOf = (raw: DatabaseSync, table: string) => raw.prepare(`SELECT * FROM ${table} ORDER BY ${table === "milestone" ? "page_id, position" : "id"}`).all() as Raw[];
const dump = (raw: DatabaseSync, sql: string) => JSON.stringify(raw.prepare(sql).all());

function counts(raw: DatabaseSync): Record<string, number> {
	const out: Record<string, number> = {};
	for (const { name } of raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]) {
		out[name] = (raw.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get() as { n: number }).n;
	}
	return out;
}

let w: World;
let root: Client;
let before: Map<string, Raw>;
let sideTables: Record<string, string>;
let countsBefore: Record<string, number>;
const SIDE_SQL: Record<string, string> = {
	post_related: "SELECT * FROM post_related ORDER BY post_id, target_type, target_id",
	media_usage: "SELECT * FROM media_usage ORDER BY media_id, entity_type, entity_id, field",
	milestone: "SELECT * FROM milestone ORDER BY page_id, position",
	album_item: "SELECT * FROM album_item ORDER BY album_id, position",
	redirect: "SELECT * FROM redirect ORDER BY from_path",
	revision: "SELECT * FROM revision",
};

/** The items the first-edit sample covers: every post with a long slug, every tenth of the rest, all articles and pages. */
const sample: { kind: Kind; table: string; id: string; row: Raw }[] = [];
/** What the public page shows of each Tông Chỉ article before any edit (its body is the designer's brief, shown after conversion). */
const shownBefore = new Map<string, string>();
const edited = new Map<string, { title: string; withBody: boolean }>();

beforeAll(async () => {
	w = await importedWorld();
	root = await w.as("root@example.test");
	before = new Map();
	for (const [table, kind] of TABLES) for (const row of rowsOf(w.raw, table)) before.set(`${kind.name}/${row.id}`, row);
	sideTables = Object.fromEntries(Object.entries(SIDE_SQL).map(([name, sql]) => [name, dump(w.raw, sql)]));
	countsBefore = counts(w.raw);
	const repo = createD1Repository(asD1(w.raw));
	for (const entry of await repo.listTongChi()) shownBefore.set(entry.slug, ((await repo.getTongChi(entry.slug))?.contentHtml ?? ""));
	let others = 0;
	for (const [key, row] of before) {
		const [kindName] = key.split("/");
		const kind = KINDS[kindName as keyof typeof KINDS];
		const long = String(row.slug).length > 80;
		if (kind.name !== "posts" || long || others++ % 10 === 0) sample.push({ kind, table: kind.table, id: String(row.id), row });
	}
}, 120_000);

describe.skipIf(!HAS_SNAPSHOT)("data integrity on the imported snapshot", () => {
	it("starts from the numbers the spec names", () => {
		expect(countsBefore.post).toBe(632);
		expect(countsBefore.teaching_article).toBe(25);
		expect(countsBefore.page).toBe(6);
		// the spec says 87; the snapshot has 80 above 80 characters (84 from 80 up, the longest 162)
		expect([...before].filter(([key, row]) => key.startsWith("posts/") && String(row.slug).length > 80).length).toBe(80);
		expect(sample.length).toBeGreaterThanOrEqual(30 + 80);
	});

	// ------------------------------------------------------------------ 1. opening and saving changes nothing
	it("1. saving every post, article and page as loaded changes nothing: no byte, no revision, no redirect, no version", async () => {
		const trouble: string[] = [];
		for (const [key] of before) {
			const [kindName, id] = key.split("/");
			const kind = KINDS[kindName as keyof typeof KINDS];
			const detail = await root.call("GET", `${kind.name}/${id}`);
			if (detail.status !== 200) {
				trouble.push(`${key}: GET ${detail.status}`);
				continue;
			}
			// (a) what the editor sends when nothing was touched: only the version
			const none = await root.call("PATCH", `${kind.name}/${id}`, { version: detail.data.version });
			if (none.status !== 200 || none.data.version !== detail.data.version) trouble.push(`${key}: {version} -> ${none.status} v${none.data?.version}`);
			// (b) every loaded value sent back
			const full: Raw = { version: detail.data.version };
			for (const name of KEYS(kind)) full[name] = detail.data[name];
			const saved = await root.call("PATCH", `${kind.name}/${id}`, full);
			if (saved.status !== 200) trouble.push(`${key}: full PATCH ${saved.status} ${JSON.stringify(saved.json?.error?.fields ?? saved.json?.error?.message)}`);
			else if (saved.data.version !== detail.data.version) trouble.push(`${key}: version ${detail.data.version} -> ${saved.data.version}`);
			// (c) the body alone, as the editor sends it once the person typed and undid it
			const body = await root.call("PATCH", `${kind.name}/${id}`, { version: detail.data.version, contentHtml: detail.data.contentHtml, contentJson: detail.data.contentJson });
			if (body.status !== 200 || body.data.version !== detail.data.version) trouble.push(`${key}: body only -> ${body.status} v${body.data?.version}`);
		}
		expect(trouble, trouble.slice(0, 15).join("\n")).toEqual([]);

		const changed: string[] = [];
		for (const [table, kind] of TABLES) {
			for (const now of rowsOf(w.raw, table)) {
				const was = before.get(`${kind.name}/${now.id}`)!;
				for (const column of Object.keys(was)) if (now[column] !== was[column]) changed.push(`${kind.name}/${now.id}.${column}`);
			}
		}
		expect(changed.slice(0, 15), `${changed.length} columns differ`).toEqual([]);
		for (const name of Object.keys(SIDE_SQL)) expect(dump(w.raw, SIDE_SQL[name]), name).toBe(sideTables[name]);
		expect(counts(w.raw)).toEqual({ ...countsBefore, session: expect.any(Number), audit_log: expect.any(Number) });
	}, 900_000);

	// ------------------------------------------------------------------ 2. the first real edit makes exactly two versions
	it("2. the first edit of the sample makes the versions [N, N+1] and restoring N gives the import back byte for byte", async () => {
		const trouble: string[] = [];
		let n = 0;
		for (const item of sample) {
			const key = `${item.kind.name}/${item.id}`;
			const start = Number(item.row.version);
			// half of each kind: a title only (the body is not written), half also the body (one paragraph at the end)
			const withBody = n++ % 2 === 1;
			const title = `${String(item.row.title)} (kiểm thử)`;
			const patch: Raw = { version: start, title };
			// an edit that touches the body as well: one paragraph at the end
			if (withBody) patch.contentHtml = `${String((await root.call("GET", `${item.kind.name}/${item.id}`)).data.contentHtml)}<p>Đoạn kiểm thử</p>`;
			const saved = await root.call("PATCH", `${item.kind.name}/${item.id}`, patch);
			if (saved.status !== 200) {
				trouble.push(`${key}: edit ${saved.status} ${JSON.stringify(saved.json?.error?.fields ?? saved.json?.error?.message)}`);
				continue;
			}
			edited.set(key, { title, withBody });
			const versions = (await root.call("GET", `${item.kind.name}/${item.id}/revisions`)).data.map((revision: Raw) => revision.version);
			if (JSON.stringify(versions) !== JSON.stringify([start + 1, start])) trouble.push(`${key}: versions ${JSON.stringify(versions)}, expected [${start + 1},${start}]`);
			if (String(w.raw.prepare(`SELECT slug FROM ${item.table} WHERE id = ?`).get(item.id)!.slug) !== String(item.row.slug)) trouble.push(`${key}: slug moved by a save that did not touch it`);
		}
		expect(trouble, trouble.slice(0, 15).join("\n")).toEqual([]);
		expect(edited.size).toBe(sample.length);
		expect((w.raw.prepare("SELECT COUNT(*) AS n FROM redirect").get() as { n: number }).n, "no slug changed, so no redirect").toBe(0);
	}, 900_000);

	it("4a. the reader shows an edit made in the admin (a post, an article and a page)", async () => {
		const repo = createD1Repository(asD1(w.raw));
		const pickOf = (kindName: string, withBody?: boolean) => sample.find((item) => item.kind.name === kindName && (withBody === undefined || edited.get(`${kindName}/${item.id}`)?.withBody === withBody))!;
		const post = pickOf("posts", true);
		const shown = await repo.getPostBySlug(String(post.row.slug), String(post.row.section));
		expect(shown?.title).toBe(edited.get(`posts/${post.id}`)!.title);
		expect(shown?.contentHtml).toContain("Đoạn kiểm thử");
		const long = sample.find((item) => item.kind.name === "posts" && String(item.row.slug).length > 80)!;
		expect((await repo.getPostBySlug(String(long.row.slug), String(long.row.section)))?.id, "the long-slug post is still at its own address").toBe(long.id);
		const article = pickOf("teachings");
		expect((await repo.getTongChi(String(article.row.slug)))?.title).toBe(edited.get(`teachings/${article.id}`)!.title);
		// changing only the title of a Tông Chỉ article must not change the text the page shows
		const moved: string[] = [];
		for (const item of sample.filter((entry) => entry.kind.name === "teachings" && !edited.get(`teachings/${entry.id}`)?.withBody)) {
			if (asShown((await repo.getTongChi(String(item.row.slug)))?.contentHtml) !== asShown(shownBefore.get(String(item.row.slug)))) moved.push(String(item.row.slug));
		}
		expect(moved, "articles whose page text changed when only their title was edited").toEqual([]);
		const page = pickOf("pages");
		expect((await repo.listAboutTopics()).find((topic) => topic.slug === String(page.row.slug))?.title).toBe(edited.get(`pages/${page.id}`)!.title);
	});

	it("2b. restoring the first version gives every sampled item its import back, column by column", async () => {
		const trouble: string[] = [];
		const shownAfter = new Set<string>();
		for (const item of sample) {
			const key = `${item.kind.name}/${item.id}`;
			if (!edited.has(key)) continue;
			const start = Number(item.row.version);
			const restored = await root.call("POST", `${item.kind.name}/${item.id}/revisions/${start}/restore`, { version: start + 1 });
			if (restored.status !== 200) {
				trouble.push(`${key}: restore ${restored.status} ${JSON.stringify(restored.json?.error?.message)}`);
				continue;
			}
			const now = w.raw.prepare(`SELECT * FROM ${item.table} WHERE id = ?`).get(item.id) as Raw;
			// A Tông Chỉ article whose body was edited keeps the editor's HTML and a cleaned Markdown from then on: the raw "designer's brief"
			// the import stored in `body` is not what a version keeps (it keeps the HTML the page shows), so for it the page is compared.
			const bodyRewritten = item.table === "teaching_article" && edited.get(key)!.withBody;
			for (const column of Object.keys(item.row)) {
				// content_html of a Tông Chỉ article: the first save fixes the HTML its page shows (empty before), so only the page is compared, below
				if (BOOKKEEPING.has(column) || (item.table === "teaching_article" && (column === "content_html" || (bodyRewritten && column === "body")))) continue;
				if (now[column] !== item.row[column]) trouble.push(`${key}.${column}: ${JSON.stringify(String(now[column]).slice(0, 80))} != ${JSON.stringify(String(item.row[column]).slice(0, 80))}`);
			}
			if (item.table === "teaching_article") shownAfter.add(String(item.row.slug));
			const versions = (await root.call("GET", `${item.kind.name}/${item.id}/revisions`)).data.map((revision: Raw) => revision.version);
			if (JSON.stringify(versions) !== JSON.stringify([start + 2, start + 1, start])) trouble.push(`${key}: versions after restore ${JSON.stringify(versions)}`);
		}
		expect(trouble, trouble.slice(0, 20).join("\n")).toEqual([]);
		// the public page of each restored article is what it was before the first edit
		const repo = createD1Repository(asD1(w.raw));
		expect(shownAfter.size).toBe(25);
		for (const slug of shownAfter) expect(asShown((await repo.getTongChi(slug))?.contentHtml), `page of ${slug}`).toBe(asShown(shownBefore.get(slug)));
	}, 900_000);

	// ------------------------------------------------------------------ 3. nothing dangling
	it("3. after the whole cycle nothing is dangling: foreign keys, revisions, usage rows, related rows, redirects", () => {
		expect(w.raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
		const orphans = (sql: string) => w.raw.prepare(sql).all();
		expect(orphans("SELECT r.id FROM revision r WHERE r.entity_type = 'post' AND r.entity_id NOT IN (SELECT id FROM post)")).toEqual([]);
		expect(orphans("SELECT r.id FROM revision r WHERE r.entity_type = 'teaching_article' AND r.entity_id NOT IN (SELECT id FROM teaching_article)")).toEqual([]);
		expect(orphans("SELECT r.id FROM revision r WHERE r.entity_type = 'page' AND r.entity_id NOT IN (SELECT id FROM page)")).toEqual([]);
		expect(orphans("SELECT * FROM revision WHERE entity_type NOT IN ('post','teaching_article','page')")).toEqual([]);
		expect(orphans("SELECT * FROM media_usage WHERE media_id NOT IN (SELECT id FROM media)")).toEqual([]);
		expect(
			orphans(
				`SELECT * FROM media_usage u WHERE (u.entity_type = 'post' AND u.entity_id NOT IN (SELECT id FROM post)) OR (u.entity_type = 'teaching_article' AND u.entity_id NOT IN (SELECT id FROM teaching_article))
				 OR (u.entity_type = 'page' AND u.entity_id NOT IN (SELECT id FROM page))`,
			),
		).toEqual([]);
		expect(orphans("SELECT * FROM post_related WHERE post_id NOT IN (SELECT id FROM post)")).toEqual([]);
		expect(orphans("SELECT * FROM redirect WHERE to_path = '' OR from_path = to_path")).toEqual([]);
		expect(orphans("SELECT * FROM milestone WHERE page_id NOT IN (SELECT id FROM page)")).toEqual([]);
		// every revision of an item is numbered 1..current with no gap
		for (const [table, kind] of TABLES) {
			const gaps = orphans(
				`SELECT t.id, t.version, COUNT(r.id) AS n, MAX(r.version) AS top FROM ${table} t JOIN revision r ON r.entity_type = '${kind.entityType}' AND r.entity_id = t.id GROUP BY t.id HAVING top <> t.version OR n < 1`,
			);
			expect(gaps, `${table}: revisions with a gap or behind the row`).toEqual([]);
		}
	});

	it("3b. media_usage of what was saved matches the pictures the row names", () => {
		const trouble: string[] = [];
		for (const item of sample) {
			const now = w.raw.prepare(`SELECT * FROM ${item.table} WHERE id = ?`).get(item.id) as Raw;
			const rows = w.raw.prepare("SELECT media_id, field FROM media_usage WHERE entity_type = ? AND entity_id = ?").all(item.kind.entityType, item.id) as { media_id: string; field: string }[];
			const have = new Set(rows.filter((row) => !row.field.includes(".") && row.field !== "content").map((row) => `${row.field}=${row.media_id}`));
			const want = new Set<string>();
			for (const spec of item.kind.fields) if (spec.type === "media" && typeof now[spec.column] === "string" && now[spec.column]) want.add(`${spec.column}=${now[spec.column]}`);
			// only rows that exist in the library are tracked
			const exists = (id: string) => !!w.raw.prepare("SELECT 1 FROM media WHERE id = ?").get(id);
			for (const entry of [...want]) if (!exists(entry.split("=")[1])) want.delete(entry);
			if ([...want].sort().join("|") !== [...have].sort().join("|")) trouble.push(`${item.kind.name}/${item.id}: usage ${[...have]} vs columns ${[...want]}`);
		}
		expect(trouble.slice(0, 10)).toEqual([]);
	});

	// ------------------------------------------------------------------ 4. what the reader hides
	it("4b. the reader hides a draft, a hidden item, a scheduled one that is not yet due and one in the trash, and shows a scheduled one that is due", async () => {
		const trouble: string[] = [];
		const checks: { label: string; kind: Kind; id: string; slug: string; section: string; expect: "shown" | "hidden" }[] = [];
		const future = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();
		for (const kindName of ["posts", "teachings", "pages"] as const) {
			const kind = KINDS[kindName];
			const source = sample.find((item) => item.kind.name === kindName)!;
			const make = async (label: string, steps: [string, Raw?][], expectation: "shown" | "hidden") => {
				const dup = (await root.call("POST", `${kind.name}/${source.id}/duplicate`)).data as Raw;
				let version = Number(dup.version);
				for (const [action, extra] of steps) {
					const step = action === "trash" ? await root.call("DELETE", `${kind.name}/${dup.id}`) : await root.call("POST", `${kind.name}/${dup.id}/${action}`, { version, ...(extra ?? {}) });
					if (step.status >= 300) trouble.push(`${kind.name} ${label}: ${action} -> ${step.status} ${JSON.stringify(step.json?.error?.message)}`);
					else if (step.data?.version) version = Number(step.data.version);
				}
				checks.push({ label, kind, id: String(dup.id), slug: String(dup.slug), section: String(dup.section ?? ""), expect: expectation });
			};
			await make("draft", [], "hidden");
			await make("published", [["publish"]], "shown");
			await make("hidden", [["publish"], ["hide"]], "hidden");
			await make("scheduled-future", [["publish", { publishAt: future }]], "hidden");
			await make("trashed", [["publish"], ["unpublish"], ["trash"]], "hidden");
			// a scheduled item whose time has come is on the site (the status is read, not stored: no job moves it)
			await make("scheduled-due", [["publish", { publishAt: future }]], "shown");
			const due = checks[checks.length - 1];
			w.raw.prepare(`UPDATE ${kind.table} SET publish_at = ? WHERE id = ?`).run(new Date(Date.now() - 3600_000).toISOString(), due.id);
		}
		const repo = createD1Repository(asD1(w.raw));
		for (const check of checks) {
			const found =
				check.kind.name === "posts"
					? await repo.getPostBySlug(check.slug, check.section)
					: check.kind.name === "teachings"
						? await repo.getTongChi(check.slug)
						: (await repo.listAboutTopics()).find((topic) => topic.slug === check.slug);
			// the duplicate of a slug gets a "-2" style suffix, so the source's own item must not be what answers
			const answers = !!found && (found as { id: string }).id === check.id;
			if (check.expect === "shown" && !answers) trouble.push(`${check.kind.name} ${check.label}: should be shown at ${check.slug}`);
			if (check.expect === "hidden" && answers) trouble.push(`${check.kind.name} ${check.label}: should be hidden at ${check.slug}`);
		}
		expect(trouble).toEqual([]);
		// the list of posts has none of the hidden ones either
		const listed = new Set((await repo.listPosts({ pageSize: 2000 })).items.map((item) => item.id));
		for (const check of checks.filter((item) => item.kind.name === "posts")) expect(listed.has(check.id), `post ${check.label} in the list`).toBe(check.expect === "shown");
	}, 300_000);

	// ------------------------------------------------------------------ 5. counts
	it("5. per table, the rows are what they were, except what the test made", () => {
		const now = counts(w.raw);
		const pageCopies = (w.raw.prepare("SELECT COUNT(*) AS n FROM milestone WHERE page_id IN (SELECT id FROM page WHERE slug LIKE '%-sao-chep%')").get() as { n: number }).n;
		const made = { post: 6, teaching_article: 6, page: 6, milestone: pageCopies };
		const changed: string[] = [];
		for (const [name, was] of Object.entries(countsBefore)) {
			// session/audit/revision grow by design; media_usage is rebuilt for what was saved (an import's usage rows come from the backfill)
			if (["session", "audit_log", "revision", "rate_limit", "media_usage"].includes(name)) continue;
			const extra = (made as Record<string, number>)[name] ?? 0;
			if (now[name] !== was + extra) changed.push(`${name}: ${was} -> ${now[name]} (expected ${was + extra})`);
		}
		expect(changed).toEqual([]);
		expect((w.raw.prepare("SELECT COUNT(*) AS n FROM redirect").get() as { n: number }).n).toBe(0);
	});
});

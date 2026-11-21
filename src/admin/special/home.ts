// The home page builder: each block is a row of `setting` (home.hero, home.welcome, home.stats, home.buddhist_year,
// home.quotes). Editors with the update right write a draft under "<key>.draft"; saving the live key (publish)
// needs the publish right and removes the draft. The public site reads the live keys only.
import { site } from "../../config/site";
import { HOME_BLOCKS, isHomeBlock, type HomeBlock } from "../../libs/homeSettings";
import { buddhistYear } from "../../libs/lunar";
import { todayInVietnam } from "../../libs/calendar";
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type AdminStmt } from "../db";
import { ApiError, notFound } from "../http/errors";
import { mediaPath, replaceUsageStatements } from "../media/service";
import { audit, checkMediaAll, json } from "./common";

export type BlockState = { block: HomeBlock; key: string; label: string; live: unknown | null; draft: unknown | null; hasDraft: boolean };

const keyOf = (block: HomeBlock) => HOME_BLOCKS[block].key;

async function readKey(ctx: AuthContext, key: string): Promise<unknown | null> {
	const row = await ctx.db.prepare("SELECT value FROM setting WHERE key = ?").bind(key).first();
	return row ? json<unknown | null>(row.value, null) : null;
}

const writeKey = (ctx: AuthContext, key: string, value: unknown): AdminStmt =>
	ctx.db.prepare("INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, JSON.stringify(value));

/** What the site shows today when a block has no setting: the form starts from these. */
export function homeDefaults(now: Date) {
	return {
		hero: { title: site.hero.title, subtitle: site.hero.subtitle, text: site.intro, ctaLabel: site.hero.link.label, ctaHref: site.hero.link.href },
		stats: [
			{ label: "Bài viết Dòng Chảy Hoằng Pháp", source: "auto-bai-dong-chay", value: 0 },
			{ label: "Bài giảng, pháp âm, ấn phẩm Trí Tuệ Phật Pháp", source: "auto-bai-tri-tue", value: 0 },
			{ label: "Phật lịch", source: "auto-phat-lich", value: 0 },
		],
		buddhist_year: { mode: "auto", value: buddhistYear(todayInVietnam(now)) },
		quotes: { source: "chu-de-thang", mode: "thu-tu" },
	};
}

export async function getHome(ctx: AuthContext) {
	const blocks: BlockState[] = [];
	for (const block of Object.keys(HOME_BLOCKS) as HomeBlock[]) {
		const key = keyOf(block);
		const [live, draft] = await Promise.all([readKey(ctx, key), readKey(ctx, `${key}.draft`)]);
		blocks.push({ block, key, label: HOME_BLOCKS[block].label, live, draft, hasDraft: draft !== null });
	}
	const { results } = await ctx.db
		.prepare(
			`SELECT a.id, a.name, a.featured_position, m.r2_key, m.url FROM area a LEFT JOIN media m ON m.id = a.cover_media_id
			 WHERE a.deleted_at IS NULL AND a.featured = 1 ORDER BY a.featured_position, a.id`,
		)
		.all();
	// Pictures named by the blocks, so the form can show them.
	const ids = new Set<string>();
	for (const state of blocks) for (const value of [state.live, state.draft]) collectMediaIds(value, ids);
	const media: Record<string, string> = {};
	for (const id of ids) {
		const row = await ctx.db.prepare("SELECT r2_key, url FROM media WHERE id = ? AND deleted_at IS NULL").bind(id).first();
		if (row) media[id] = mediaPath(text(row.r2_key) || null, text(row.url) || null);
	}
	return {
		blocks,
		media,
		defaults: homeDefaults(ctx.now()),
		featuredAreas: results.map((row) => ({ id: text(row.id), name: text(row.name), position: num(row.featured_position), coverUrl: mediaPath(text(row.r2_key) || null, text(row.url) || null) })),
	};
}

function collectMediaIds(value: unknown, into: Set<string>): void {
	if (Array.isArray(value)) value.forEach((item) => collectMediaIds(item, into));
	else if (value && typeof value === "object") {
		for (const [name, inner] of Object.entries(value)) {
			if (/MediaId$/.test(name) && typeof inner === "string" && inner) into.add(inner);
			else collectMediaIds(inner, into);
		}
	}
}

function parse(blockName: string, value: unknown): { block: HomeBlock; value: unknown } {
	if (!isHomeBlock(blockName)) throw notFound("Khối trang chủ");
	const result = HOME_BLOCKS[blockName].schema.safeParse(value);
	if (!result.success) {
		const fields: Record<string, string> = {};
		for (const issue of result.error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
		throw new ApiError(400, "invalid_input", "Dữ liệu chưa hợp lệ.", fields);
	}
	return { block: blockName, value: result.data };
}

async function validateBlock(ctx: AuthContext, block: HomeBlock, value: unknown): Promise<{ uses: { mediaId: string; field: string }[] }> {
	const uses: { mediaId: string; field: string }[] = [];
	if (block === "hero") {
		const slides = (value as { slides: { id: string; imageMediaId: string | null; portraitMediaId: string | null }[] }).slides;
		if (new Set(slides.map((slide) => slide.id)).size !== slides.length) throw new ApiError(400, "invalid_input", "Có hai khung trùng mã.", { slides: "Có hai khung trùng mã." });
		slides.forEach((slide, index) => {
			if (slide.imageMediaId) uses.push({ mediaId: slide.imageMediaId, field: `slide-${index}-image` });
			if (slide.portraitMediaId) uses.push({ mediaId: slide.portraitMediaId, field: `slide-${index}-portrait` });
		});
	}
	if (block === "welcome") {
		const id = (value as { imageMediaId: string | null }).imageMediaId;
		if (id) uses.push({ mediaId: id, field: "image" });
	}
	for (const use of uses) await checkMediaAll(ctx, "imageMediaId", [use.mediaId]);
	return { uses };
}

/** Saves a draft; with `publish` it writes the live key instead (needs the publish right, checked by the caller) and drops the draft. */
export async function saveBlock(ctx: AuthContext, by: Authed, blockName: string, input: unknown, publish: boolean) {
	const { block, value } = parse(blockName, input);
	const { uses } = await validateBlock(ctx, block, value);
	const key = keyOf(block);
	const target = publish ? key : `${key}.draft`;
	const before = await readKey(ctx, target);
	const statements: AdminStmt[] = [
		writeKey(ctx, target, value),
		...replaceUsageStatements(ctx, "setting", target, uses),
		audit(ctx, by, { action: publish ? "home.publish" : "home.save_draft", entityType: "setting", entityId: target, before: before ?? undefined, after: value }),
	];
	if (publish) statements.push(ctx.db.prepare("DELETE FROM setting WHERE key = ?").bind(`${key}.draft`), ...replaceUsageStatements(ctx, "setting", `${key}.draft`, []));
	await ctx.db.batch(statements);
	return getBlock(ctx, block);
}

/** Copies the draft over the live value. */
export async function publishDraft(ctx: AuthContext, by: Authed, blockName: string) {
	if (!isHomeBlock(blockName)) throw notFound("Khối trang chủ");
	const key = keyOf(blockName);
	const draft = await readKey(ctx, `${key}.draft`);
	if (draft === null) throw new ApiError(409, "no_draft", "Khối này chưa có bản nháp để xuất bản.");
	// A draft that was valid when saved is checked again: the pictures it names may have been deleted since.
	return saveBlock(ctx, by, blockName, draft, true);
}

export async function discardDraft(ctx: AuthContext, by: Authed, blockName: string) {
	if (!isHomeBlock(blockName)) throw notFound("Khối trang chủ");
	const key = keyOf(blockName);
	const draft = await readKey(ctx, `${key}.draft`);
	if (draft === null) throw new ApiError(409, "no_draft", "Khối này không có bản nháp.");
	await ctx.db.batch([
		ctx.db.prepare("DELETE FROM setting WHERE key = ?").bind(`${key}.draft`),
		...replaceUsageStatements(ctx, "setting", `${key}.draft`, []),
		audit(ctx, by, { action: "home.discard_draft", entityType: "setting", entityId: `${key}.draft`, before: draft }),
	]);
	return getBlock(ctx, blockName);
}

export async function getBlock(ctx: AuthContext, blockName: string): Promise<BlockState> {
	if (!isHomeBlock(blockName)) throw notFound("Khối trang chủ");
	const key = keyOf(blockName);
	const [live, draft] = await Promise.all([readKey(ctx, key), readKey(ctx, `${key}.draft`)]);
	return { block: blockName, key, label: HOME_BLOCKS[blockName].label, live, draft, hasDraft: draft !== null };
}

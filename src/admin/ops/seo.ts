// SEO defaults (setting `seo.defaults`): the title, description and share picture the site uses where a page has none of its own,
// and extra lines for robots.txt.
import { z } from "zod";
import type { AuthContext, Authed } from "../auth/service";
import { text } from "../db";
import { mediaPath, replaceUsageStatements } from "../media/service";
import { parseRobotsExtra } from "../../libs/robotsExtra";
import { audit, invalid } from "./common";
import { getSetting, putSettingStatement } from "./store";

export const SEO_KEY = "seo.defaults";

export const seoSchema = z.object({
	title: z.string().trim().max(120, "Tiêu đề tối đa 120 ký tự.").default(""),
	description: z.string().trim().max(300, "Mô tả tối đa 300 ký tự.").default(""),
	ogMediaId: z.string().trim().max(120).nullable().optional(),
	robotsExtra: z.string().max(4000, "Phần thêm vào robots.txt quá dài.").default(""),
});

export type SeoDefaults = { title: string; description: string; ogMediaId: string | null; ogUrl: string; robotsExtra: string };

async function pictureUrl(ctx: AuthContext, id: string | null): Promise<string> {
	if (!id) return "";
	const row = await ctx.db.prepare("SELECT r2_key, url FROM media WHERE id = ? AND deleted_at IS NULL").bind(id).first();
	return row ? mediaPath(text(row.r2_key) || null, text(row.url) || null) : "";
}

export async function getSeoDefaults(ctx: AuthContext): Promise<SeoDefaults> {
	const stored = (await getSetting<Partial<SeoDefaults>>(ctx.db, SEO_KEY)) ?? {};
	const ogMediaId = stored.ogMediaId ? String(stored.ogMediaId) : null;
	return { title: text(stored.title), description: text(stored.description), ogMediaId, ogUrl: await pictureUrl(ctx, ogMediaId), robotsExtra: text(stored.robotsExtra) };
}

export async function putSeoDefaults(ctx: AuthContext, by: Authed, input: z.infer<typeof seoSchema>): Promise<SeoDefaults> {
	const robots = parseRobotsExtra(input.robotsExtra);
	if (!robots.ok) throw invalid("robotsExtra", robots.message);
	const ogMediaId = input.ogMediaId || null;
	if (ogMediaId && !(await pictureUrl(ctx, ogMediaId))) throw invalid("ogMediaId", "Ảnh chia sẻ không còn trong thư viện.");
	const before = await getSeoDefaults(ctx);
	const value = { title: input.title, description: input.description, ogMediaId, robotsExtra: robots.lines.join("\n") };
	await ctx.db.batch([
		putSettingStatement(ctx.db, SEO_KEY, value),
		...replaceUsageStatements(ctx, "setting", SEO_KEY, ogMediaId ? [{ mediaId: ogMediaId, field: "og" }] : []),
		audit(ctx, by, { action: "seo.defaults_update", entityType: "setting", entityId: SEO_KEY, before: { title: before.title, description: before.description, ogMediaId: before.ogMediaId, robotsExtra: before.robotsExtra }, after: value }),
	]);
	return getSeoDefaults(ctx);
}

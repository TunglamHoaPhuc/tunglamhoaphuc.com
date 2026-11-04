// The old admin's Vũ Trụ Phật Giáo file (`{ success, count, areas }`) → Area, and its Bảo
// Tượng file (`{ success, total, statues }`) → StatueSummary, for the map, the area pages and
// (T16) the statues. Lenient like the other adapters: a record without a slug or name is
// reported and left out, the rest falls back to empty values.
import { z } from "zod";
import { titleCase } from "../format";
import { mediaUrl } from "./media";
import { bare, cleanText, renderContent } from "./normalize";
import type { Area, ContentIssue, MediaImage, StatueSummary } from "./types";

const text = z.string().catch("");
const percent = z.coerce.number().min(0).max(100);

const rawAreaSchema = z.object({
	id: z.union([z.string(), z.number()]).transform(String),
	slug: z.string().trim().min(1),
	name: z.string().trim().min(1),
	subtitle: text,
	temple: text,
	imgUrl: text,
	mapPos: z.object({ x: percent, y: percent }).nullish().catch(null),
	description: text,
	fullContent: text,
});

const rawStatueSchema = z.object({
	id: z.union([z.string(), z.number()]).transform(String),
	code: text,
	slug: z.string().trim().min(1),
	name: text,
	title: text,
	subtitle: text,
	categoryType: text,
	areaSlug: text,
	imgUrl: text,
	avatarUrl: text,
	imgPosition: text,
});

const listOf = (key: string) =>
	z.union([z.array(z.unknown()), z.object({ [key]: z.array(z.unknown()) }).transform((file) => (file as Record<string, unknown[]>)[key])]);

const plain = (value: string) => cleanText(value).replace(/\s+/g, " ").trim();

function image(url: string, position = ""): MediaImage | null {
	const src = mediaUrl(url);
	return src ? { src, position: position.trim() || "center 50%" } : null;
}

function invalid(raw: unknown, message: string | undefined): ContentIssue {
	return { kind: "invalid", id: String((raw as { id?: unknown })?.id ?? "?"), message: message ?? "bản ghi không đọc được" };
}

export type ParsedAreas = { areas: Area[]; issues: ContentIssue[] };

export function parseAreas(file: unknown): ParsedAreas {
	const issues: ContentIssue[] = [];
	const areas: Area[] = [];
	for (const raw of listOf("areas").safeParse(file).data ?? []) {
		const result = rawAreaSchema.safeParse(raw);
		if (!result.success) {
			issues.push(invalid(raw, result.error.issues[0]?.message));
			continue;
		}
		const area = result.data;
		const intro = plain(area.description);
		// Some areas hold the same text in both fields.
		const content = bare(cleanText(area.fullContent)) === bare(intro) ? "" : area.fullContent;
		areas.push({
			id: area.id,
			slug: area.slug,
			name: titleCase(plain(area.name)),
			subtitle: titleCase(plain(area.subtitle)),
			temple: area.temple.trim(),
			cover: image(area.imgUrl),
			mapPos: area.mapPos ?? null,
			intro,
			contentHtml: renderContent(content),
		});
	}
	return { areas, issues };
}

export type ParsedStatues = { statues: StatueSummary[]; issues: ContentIssue[] };

export function parseStatues(file: unknown): ParsedStatues {
	const issues: ContentIssue[] = [];
	const statues: StatueSummary[] = [];
	for (const raw of listOf("statues").safeParse(file).data ?? []) {
		const result = rawStatueSchema.safeParse(raw);
		if (!result.success) {
			issues.push(invalid(raw, result.error.issues[0]?.message));
			continue;
		}
		const statue = result.data;
		const code = statue.code.trim();
		const slug = statue.slug.trim();
		if (code && !slug.endsWith(`_${code.toLowerCase()}`)) {
			issues.push({ kind: "statue-code", id: statue.id, message: `slug "${slug}" không kết thúc bằng mã ${code}` });
		}
		statues.push({
			id: statue.id,
			code,
			slug,
			name: titleCase(plain(statue.name || statue.title)),
			subtitle: plain(statue.subtitle),
			areaCode: statue.areaSlug.trim(),
			main: statue.categoryType.trim().toUpperCase() === "TƯỢNG CHÍNH",
			image: image(statue.avatarUrl || statue.imgUrl, statue.imgPosition),
			href: `/bao-tuong/${slug}`,
		});
	}
	const uncoded = statues.filter((statue) => statue.main && !statue.code);
	if (uncoded.length) {
		issues.push({
			kind: "statue-code",
			id: `${uncoded.length} tượng chính không có mã TP (địa chỉ không có đuôi _tpXXXX)`,
			message: uncoded.map((statue) => statue.name).join("; "),
		});
	}
	return { statues, issues };
}

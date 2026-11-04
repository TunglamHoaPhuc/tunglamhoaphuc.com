// The old admin's Vũ Trụ Phật Giáo file (`{ success, count, areas }`) → Area, for the map
// and the area pages (the statues are in baoTuong.ts). Lenient like the other adapters: an
// area without a slug or name is reported and left out, the rest falls back to empty values.
import { z } from "zod";
import { titleCase } from "../format";
import { mediaUrl } from "./media";
import { bare, cleanText, renderContent } from "./normalize";
import type { Area, ContentIssue, MediaImage } from "./types";

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

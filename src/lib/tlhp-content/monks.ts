// The old admin's Danh Tăng file (`{ success, total, data }`, 91 monks and nuns) → Monk.
// Lenient like the other adapters: a record without an id or a name is reported and left
// out, the rest falls back to empty values. No page reads it yet (Chư Tôn Đức, T13b, has its
// own list); it is here so the import (T23) carries all of the old admin's data.
import { z } from "zod";
import { mediaUrl } from "./media";
import { cleanText } from "./normalize";
import type { ContentIssue, Monk } from "./types";

const text = z.string().catch("");
const percent = z.coerce.number().min(0).max(100);

const rawMonkSchema = z.object({
	id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1)),
	name: z.string().trim().min(1),
	lifespan: text,
	region: text,
	hoi_chung: text,
	sect: text,
	era: text,
	sub_era: text,
	avatarUrl: text,
	phapNgu: text,
	bio: text,
	coordinates: z.object({ x: percent, y: percent }).nullish().catch(null),
});

const monksFileSchema = z.union([
	z.array(z.unknown()),
	z.object({ data: z.array(z.unknown()) }).transform((file) => file.data),
]);

const plain = (value: string) => cleanText(value).replace(/\s+/g, " ").trim();

export type ParsedMonks = { monks: Monk[]; issues: ContentIssue[] };

export function parseMonks(file: unknown): ParsedMonks {
	const issues: ContentIssue[] = [];
	const monks: Monk[] = [];
	for (const raw of monksFileSchema.safeParse(file).data ?? []) {
		const result = rawMonkSchema.safeParse(raw);
		if (!result.success) {
			issues.push({ kind: "invalid", id: String((raw as { id?: unknown })?.id ?? "?"), message: result.error.issues[0]?.message ?? "bản ghi không đọc được" });
			continue;
		}
		const monk = result.data;
		monks.push({
			id: monk.id,
			name: plain(monk.name),
			lifespan: plain(monk.lifespan),
			region: plain(monk.region),
			sangha: plain(monk.hoi_chung),
			sect: plain(monk.sect),
			era: plain(monk.era),
			subEra: plain(monk.sub_era),
			avatar: mediaUrl(monk.avatarUrl),
			dharmaQuote: plain(monk.phapNgu),
			bio: monk.bio.trim(),
			coordinates: monk.coordinates ?? null,
		});
	}
	return { monks, issues };
}

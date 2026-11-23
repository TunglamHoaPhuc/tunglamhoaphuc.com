// The old admin's Bảo Tượng file (`{ success, total, statues }`, 126 statues) → StatueSummary
// for lists and area pages, and Statue for a statue's own page. Lenient like the other
// adapters: a statue without a slug is reported and left out, the rest falls back to empty
// values. The text is turned into HTML only when its page is asked for.
import { cleanBodyHtml } from "../tlhp-admin/special/html";
import { z } from "zod";
import { titleCase } from "../format";
import { mediaUrl } from "./media";
import { bare, cleanText, renderContent } from "./normalize";
import type { ArtVariation, ContentIssue, MediaImage, Statue, StatueSummary } from "./types";

const text = z.string().catch("");

const rawStatueSchema = z.object({
	id: z.union([z.string(), z.number()]).transform(String),
	code: text,
	slug: z.string().trim().min(1),
	name: text,
	title: text,
	subtitle: text,
	categoryType: text,
	areaSlug: text,
	assemblyId: text,
	assemblyName: text,
	clusterName: text,
	imgUrl: text,
	avatarUrl: text,
	imgPosition: text,
	quote: text,
	quoteAuthor: text,
	articleContent: text,
	fullHistoryHtml: text,
	artVariations: z.array(z.object({ id: text, title: text, location: text, meaning: text, imgUrl: text })).catch([]),
});

const statuesFileSchema = z.union([
	z.array(z.unknown()),
	z.object({ statues: z.array(z.unknown()) }).transform((file) => file.statues),
]);

const plain = (value: string) => cleanText(value).replace(/\s+/g, " ").trim();

// Raw codes the old admin stored instead of a place's name (seen on the live page as "LAM_TI_NI").
const PLACE_NAMES: Record<string, string> = { LAM_TI_NI: "Lâm Tỳ Ni" };
const place = (value: string) => {
	const name = plain(value);
	return PLACE_NAMES[name] ?? (/^[A-Z0-9]+(_[A-Z0-9]+)+$/.test(name) ? name.replace(/_/g, " ") : name);
};

// A page number sometimes ends up as the last paragraph of a story (a final "2" after "…tôn giả A Nan.").
const withoutTrailingNumber = (body: string) => body.trim().replace(/\n+\s*\d{1,3}\s*$/, "");

// Group names the editors gave to statues of no group: the section's own name, and that of
// the works of art.
const NO_GROUP = new Set(["bao tuong phat giao", "nghe thuat phat giao"]);

function image(url: string, position = ""): MediaImage | null {
	const src = mediaUrl(url);
	return src ? { src, position: position.trim() || "center 50%" } : null;
}

/** "<p>…</p><p>…</p>" (the only tags the file uses) as paragraphs of text for renderContent. */
function paragraphsOf(html: string): string {
	return html
		.replace(/<\/p>\s*/gi, "\n\n")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]*>/g, "")
		.trim();
}

/** A statue as read, its text still the editors'. */
export type StatueEntry = Omit<Statue, "contentHtml"> & { text: string };

export type ParsedStatues = { statues: StatueEntry[]; issues: ContentIssue[] };

export function parseStatues(file: unknown): ParsedStatues {
	const issues: ContentIssue[] = [];
	const records: z.infer<typeof rawStatueSchema>[] = [];
	for (const raw of statuesFileSchema.safeParse(file).data ?? []) {
		const result = rawStatueSchema.safeParse(raw);
		if (result.success) records.push(result.data);
		else issues.push({ kind: "invalid", id: String((raw as { id?: unknown })?.id ?? "?"), message: result.error.issues[0]?.message ?? "tượng không đọc được" });
	}
	const hrefOf = new Map(records.map((statue) => [statue.id, `/bao-tuong/${statue.slug.trim()}`]));

	const statues = records.map((statue): StatueEntry => {
		const code = statue.code.trim();
		const slug = statue.slug.trim();
		if (code && !slug.endsWith(`_${code.toLowerCase()}`)) {
			issues.push({ kind: "statue-code", id: statue.id, message: `slug "${slug}" không kết thúc bằng mã ${code}` });
		}
		const name = titleCase(plain(statue.name || statue.title));
		// Most "quotes" only repeat the statue's name.
		const quote = plain(statue.quote);
		const art = statue.artVariations.map(
			(variation): ArtVariation => ({
				id: variation.id.trim(),
				title: plain(variation.title),
				location: place(variation.location),
				meaning: plain(variation.meaning),
				image: image(variation.imgUrl),
				href: hrefOf.get(variation.id.trim()) ?? null,
			}),
		);
		return {
			id: statue.id,
			code,
			slug,
			name,
			subtitle: plain(statue.subtitle),
			areaCode: statue.areaSlug.trim(),
			main: statue.categoryType.trim().toUpperCase() === "TƯỢNG CHÍNH",
			image: image(statue.avatarUrl || statue.imgUrl, statue.imgPosition),
			href: `/bao-tuong/${slug}`,
			assembly: { slug: statue.assemblyId.trim(), name: plain(statue.assemblyName) },
			cluster: NO_GROUP.has(bare(statue.clusterName)) ? "" : plain(statue.clusterName),
			quote: quote && bare(quote) !== bare(name) && bare(quote) !== bare(statue.title) ? { text: quote, author: titleCase(plain(statue.quoteAuthor)) } : null,
			art,
			images: [],
			specs: [],
			seoTitle: "",
			seoDescription: "",
			// The same text is stored twice, as text and as paragraphs of HTML.
			text: withoutTrailingNumber(statue.articleContent) || paragraphsOf(statue.fullHistoryHtml),
		};
	});

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

export function statueSummary({ id, code, slug, name, subtitle, areaCode, main, image, href, assembly, cluster }: StatueEntry): StatueSummary {
	return { id, code, slug, name, subtitle, areaCode, main, image, href, assembly, cluster };
}

/** The statue with its text as safe HTML. */
export function statueArticle(entry: StatueEntry): Statue {
	const { text: body, ...statue } = entry;
	// A body the admin saved is HTML (already cleaned when saved; cleaned again here, since this is the public page); the old
	// admin's text is plain paragraphs, which renderContent turns into HTML.
	return { ...statue, contentHtml: body.trimStart().startsWith("<") ? cleanBodyHtml(body) : renderContent(body) };
}

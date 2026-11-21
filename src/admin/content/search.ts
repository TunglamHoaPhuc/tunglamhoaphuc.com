// The admin's search over articles: `search_text` holds the title, summary and text without accents, marks or
// tags ("Bồ Đề tâm" -> "bo de tam"), so "bo de", "Bồ đề" and "BO DE" all find it. Each word of a query must
// appear (in any order).
import { bare } from "../../libs/content/normalize";

/** What a row's `search_text` holds: its words without accents, cut to a size the column stays light with. */
export function searchTextOf(...parts: string[]): string {
	return bare(parts.filter(Boolean).join(" ")).slice(0, 60_000);
}

/** The words of a query, without accents; at most eight. */
export function searchWords(query: string): string[] {
	return [...new Set(bare(query).split(" ").filter(Boolean))].slice(0, 8);
}

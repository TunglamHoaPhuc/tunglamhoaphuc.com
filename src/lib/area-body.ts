// The text of an area page: the body the admin saved, cleaned once more here with the same cleaner the admin uses
// (special/html.ts: p, br, strong, em, ul, ol, li, blockquote, h2-h4, a with https or relative links); when there is
// no body, the intro as plain text, escaped. Nothing from either reaches the page as raw HTML.
import { cleanBodyHtml } from "@/lib/tlhp-admin/special/html";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function areaBodyHtml(area: { intro?: string; description?: string; contentHtml?: string }): string {
	const body = cleanBodyHtml(area.contentHtml ?? "").trim();
	if (body) return body;
	const intro = (area.intro ?? area.description ?? "").trim();
	return intro
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`)
		.join("");
}

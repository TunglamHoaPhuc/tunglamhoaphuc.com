// Looks icons up in the library and draws them. Imported on the server only (the admin API and the public header's
// server wrapper): the library is about 50 KB of data that visitors' browsers never need.
import { ICON_LIBRARY, type LibraryIcon } from "./library";

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const byName = new Map<string, LibraryIcon>(ICON_LIBRARY.map((icon) => [icon.name, icon]));
const searchText = ICON_LIBRARY.map((icon) => ({ icon, text: `${icon.name.replace(/-/g, " ")} ${plain(icon.keywords)}` }));

export const hasIcon = (name: string) => byName.has(name);

/** The library icon as a standalone <svg> (24 x 24, drawn with the current text colour). */
export function librarySvg(name: string): string | null {
	const icon = byName.get(name);
	if (!icon) return null;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon.body}</svg>`;
}

export type IconHit = { name: string; keywords: string; svg: string };

/** Icons whose name or Vietnamese words contain every word typed (accents and case are ignored); no text lists the first `limit`. */
export function searchIcons(query: string, limit = 60): IconHit[] {
	const words = plain(query).split(/[^a-z0-9]+/).filter(Boolean);
	const hits = searchText.filter(({ text }) => words.every((word) => text.includes(word))).slice(0, limit);
	return hits.map(({ icon }) => ({ name: icon.name, keywords: icon.keywords, svg: librarySvg(icon.name) as string }));
}


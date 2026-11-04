// The sections this site already serves. A link into a section still to come (Trí Tuệ Phật
// Pháp before T17, the statues' pages before T16) shows as plain text until its task adds
// the section here.
export const LIVE_PATHS = ["/tong-chi-tu-hoc", "/gioi-thieu", "/dong-chay-hoang-phap", "/lich-tu-hoc", "/vu-tru-phat-giao"];

/** The path when this site serves it, else `null`. */
export function liveHref(url: string): string | null {
	const path = url.trim();
	return LIVE_PATHS.some((live) => path === live || path.startsWith(`${live}/`) || path.startsWith(`${live}#`)) ? path : null;
}

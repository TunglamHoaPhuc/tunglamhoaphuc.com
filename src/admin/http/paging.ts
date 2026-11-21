// Lists: `?page=1&pageSize=20`, answered as `{ data: [...], meta: { page, pageSize, total } }`.
export type Page = { page: number; pageSize: number; offset: number };

export function pageOf(query: URLSearchParams, defaultSize = 20, maxSize = 100): Page {
	const page = Math.max(1, Math.floor(Number(query.get("page"))) || 1);
	const pageSize = Math.min(maxSize, Math.max(1, Math.floor(Number(query.get("pageSize"))) || defaultSize));
	return { page, pageSize, offset: (page - 1) * pageSize };
}

export const listResponse = <T>(data: T[], page: Page, total: number) => new Response(JSON.stringify({ data, meta: { page: page.page, pageSize: page.pageSize, total } }), {
	status: 200,
	headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
});

/** Escapes % and _ so a search word is matched literally by LIKE ... ESCAPE '\'. */
export const likeWord = (word: string) => `%${word.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

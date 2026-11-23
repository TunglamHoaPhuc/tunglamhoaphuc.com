// "Lời Thầy dạy" trên trang chủ V3, chọn và xếp ĐÚNG như trang www (src/libs/home.ts, src/libs/homeData.ts, src/components/sections/
// testimonials/Testimonials2.js của www) từ chính dữ liệu D1 mà admin dùng chung:
//
//  - Khối `home.quotes` (admin: /quan-tri/trang-chu) có hai trường: `source` ("trich-dan" | "chu-de-thang") và `mode`
//    ("thu-tu" | "ngau-nhien"). Không có cờ bật/tắt, số lượng hay tiêu đề riêng: tiêu đề luôn là "Lời Thầy dạy".
//  - `source = "trich-dan"` và có ít nhất một lời dạy đang bật (bảng `quote`: active = 1, chưa vào thùng rác, xếp theo `position, id`,
//    tối đa 200 như www): trượt các lời dạy đó, theo thứ tự admin hoặc xáo trộn khi trang đã mở trong trình duyệt (mode).
//  - Ngược lại (mặc định, thiếu/hỏng cài đặt, hoặc chưa có lời dạy nào đang bật): trượt các câu kệ của chủ đề tháng, từ tháng này trở đi
//    rồi vòng lại đầu năm, bỏ tháng không có câu kệ. Thứ tự không bao giờ xáo trộn.
//  - Không có gì để hiện (không lời dạy, không câu kệ) thì trả `null`: trang không vẽ khối.
//
// Đọc hỏng ở bất kỳ bước nào thì lùi về bước kế tiếp (không bao giờ ném lỗi ra trang chủ). Chỉ ĐỌC D1, không ghi.
// Kết quả là object thuần (JSON được), nhận thẳng làm props của QuotesSection. Không import mô-đun nào của máy chủ ở đầu tệp
// ngoài kiểu và bộ đọc nội dung, và QuotesSection chỉ `import type` từ đây.
import { decodeHtmlEntities } from "@/lib/html-entities";
import { getContentRepository } from "@/lib/tlhp-content/repository";
import type { D1Like } from "@/lib/tlhp-content/sources/d1";
import type { ContentRepository, MonthTheme } from "@/lib/tlhp-content/types";
import { readQuotesSetting, safeHref, type QuotesSetting } from "@/lib/tlhp-site/homeSettings";
import { siteDb } from "@/lib/v3-db";

/** Một lời dạy hoặc câu kệ: `text` là chữ thuần, các đoạn cách nhau bằng xuống dòng. */
export type HomeQuoteItem = { id: string; text: string; author: string; source: string; /** Đã kiểm: "" hoặc https://… hoặc đường dẫn nội bộ. */ sourceUrl: string };

export type HomeQuotes = {
	/** "trich-dan": lời dạy admin nhập; "chu-de-thang": câu kệ của chủ đề tháng. */
	kind: "trich-dan" | "chu-de-thang";
	/** "ngau-nhien" chỉ có với "trich-dan" và hơn một lời; trình duyệt xáo trộn sau khi mở trang (bản máy chủ giữ thứ tự admin). */
	mode: "thu-tu" | "ngau-nhien";
	/** Dòng nhỏ trên tiêu đề: "Lời dạy của Thầy" hoặc "Chủ đề tháng N". */
	eyebrow: string;
	items: HomeQuoteItem[];
};

/** www lấy tối đa chừng này lời dạy. */
export const MAX_QUOTES = 200;

const SETTING_KEY = "home.quotes";

/** Tháng (1–12) hôm nay theo giờ Việt Nam (UTC+7). */
function monthInVietnam(now: Date): number {
	return Number(new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(5, 7));
}

/** Địa chỉ nguồn mà trang chịu dẫn tới: https://… hoặc đường dẫn nội bộ một dấu "/"; mọi thứ khác (javascript:, //host, trống…) thành "". */
export function safeSourceUrl(value: string): string {
	const url = value.trim();
	if (!url || !safeHref(url)) return "";
	if (url.startsWith("/")) return url;
	try {
		return new URL(url).protocol === "https:" ? url : "";
	} catch {
		return "";
	}
}

/** Câu kệ của chủ đề tháng thành chữ thuần: bỏ thẻ <b>, giải mã ký tự đặc biệt (bộ đọc lịch chỉ để lại <b>). */
const plain = (html: string) => decodeHtmlEntities(html.replace(/<[^>]*>/g, "")).trim();

/** Chủ đề này tháng trước, các tháng sau nó, rồi vòng lại: như `versesFrom` của www. */
function versesFrom(themes: MonthTheme[], month: number): MonthTheme[] {
	const withVerse = themes.filter((theme) => theme.lines.some((line) => plain(line)));
	return [...withVerse.filter((theme) => theme.month >= month), ...withVerse.filter((theme) => theme.month < month)];
}

/** Giá trị cài đặt không phải JSON thì bỏ qua (như siteData của www), không phải lỗi. */
function parseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

async function readSetting(db: D1Like | null): Promise<QuotesSetting | null> {
	if (!db) return null;
	try {
		const row = (await db.prepare("select value from setting where key = ?").bind(SETTING_KEY).all<{ value?: unknown }>()).results[0];
		return typeof row?.value === "string" ? readQuotesSetting(parseJson(row.value)) : null;
	} catch (error) {
		console.error("v3-home-quotes: không đọc được home.quotes, dùng câu kệ chủ đề tháng", error);
		return null;
	}
}

async function readQuotes(repo: ContentRepository): Promise<HomeQuoteItem[]> {
	try {
		return (await repo.listQuotes())
			.filter((quote) => quote.text.trim())
			.slice(0, MAX_QUOTES)
			.map((quote) => ({ id: quote.id, text: quote.text, author: quote.author, source: quote.source, sourceUrl: safeSourceUrl(quote.sourceUrl) }));
	} catch (error) {
		console.error("v3-home-quotes: không đọc được lời dạy", error);
		return [];
	}
}

async function readThemes(repo: ContentRepository): Promise<MonthTheme[]> {
	try {
		return (await repo.getSchedule()).themes;
	} catch (error) {
		console.error("v3-home-quotes: không đọc được chủ đề tháng", error);
		return [];
	}
}

/**
 * Khối Lời Thầy dạy của trang chủ, hoặc `null` khi không có gì để hiện.
 * `repo` mặc định là bộ đọc nội dung của máy chủ, `db` mặc định là D1 của Worker (null khi V3 không đọc từ D1: khi đó chỉ có câu kệ).
 */
export async function loadHomeQuotes(repo?: ContentRepository, db?: D1Like | null, now: Date = new Date()): Promise<HomeQuotes | null> {
	try {
		const content = repo ?? (await getContentRepository());
		const setting = await readSetting(db === undefined ? await siteDb() : db);
		if (setting?.source === "trich-dan") {
			const items = await readQuotes(content);
			if (items.length) return { kind: "trich-dan", mode: setting.mode, eyebrow: "Lời dạy của Thầy", items };
		}
		const themes = versesFrom(await readThemes(content), monthInVietnam(now));
		if (!themes.length) return null;
		return {
			kind: "chu-de-thang",
			mode: "thu-tu",
			eyebrow: `Chủ đề tháng ${themes[0].month}`,
			items: themes.map((theme) => ({
				id: `chu-de-${theme.month}`,
				text: theme.lines.map(plain).filter(Boolean).join("\n"),
				author: theme.author,
				source: `Chủ đề tháng ${theme.month}${theme.title ? `: ${theme.title}` : ""}`,
				sourceUrl: "",
			})),
		};
	} catch (error) {
		console.error("v3-home-quotes: không dựng được khối Lời Thầy dạy", error);
		return null;
	}
}

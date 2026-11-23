// The page of one event or regular ceremony of the schedule, made from what D1 holds (v3-data.ts toScheduleData).
// Nothing is made up: a slug that matches no live event or program has no page (the route answers 404), and a field D1
// leaves empty stays empty (no default address, hour or note).
import type { HoangPhapArticle } from "@/data/dong-chay-hoang-phap-data";
import type { toScheduleData } from "@/lib/v3-data";

type ScheduleData = ReturnType<typeof toScheduleData>;

export interface ScheduleDetail {
	id: string;
	title: string;
	/** "Cộng Tu", "Khóa Lễ Truyền Thống", "Đại Lễ Sự Kiện", or a regular program's own subtitle. */
	category: string;
	solarDateStr: string;
	lunarDate: string;
	timeSlot: string;
	timeSlot2: string;
	location: string;
	description: string;
	notes: string;
	imgUrl: string;
	/** An embeddable YouTube address, or empty. */
	videoUrl: string;
}

/** The slug the old page made from a title: "Lễ Vu Lan" → "le-vu-lan". */
export function toSlug(str: string): string {
	return str
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/đ/g, "d")
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

/** The privacy-friendly embed address of a YouTube link (watch, youtu.be or embed); empty for anything else. */
export function youtubeEmbed(url: string | undefined | null): string {
	if (!url) return "";
	const id = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1];
	return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
}

type Row = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value : "");

export function findScheduleDetail(slug: string, data: Pick<ScheduleData, "customEvents" | "featuredPrograms">): ScheduleDetail | null {
	const key = slug.trim();
	if (!key) return null;

	for (const event of data.customEvents as Row[]) {
		if (str(event.slug) !== key && String(event.id) !== key && toSlug(str(event.title)) !== key) continue;
		const slot = (n: number) => (str(event[`timeSlot${n}Time`]) ? `${str(event[`timeSlot${n}Label`]) || "Thời khóa"}: ${str(event[`timeSlot${n}Time`])}` : "");
		return {
			id: String(event.id),
			title: str(event.title),
			category: str(event.category),
			solarDateStr: str(event.endDateStr) ? `${str(event.solarDateStr)} – ${str(event.endDateStr)}` : str(event.solarDateStr),
			lunarDate: "",
			timeSlot: slot(1),
			timeSlot2: slot(2),
			location: str(event.location),
			description: str(event.description),
			notes: str(event.notes),
			imgUrl: str(event.imgUrl),
			videoUrl: youtubeEmbed(str(event.videoUrl)),
		};
	}

	for (const program of data.featuredPrograms) {
		if (program.id !== key && toSlug(program.title) !== key && `khoa-le-${program.id}` !== key) continue;
		return {
			id: String(program.id),
			title: program.title,
			category: program.subtitle || "Khóa Lễ Định Kỳ",
			solarDateStr: program.time || program.schedule || "",
			lunarDate: "Cố định hàng tháng theo Âm lịch",
			timeSlot: program.time ? `Giờ bắt đầu: ${program.time}` : "",
			timeSlot2: program.duration ? `Thời lượng: ${program.duration}` : "",
			location: program.location || "",
			description: program.summary,
			notes: "",
			imgUrl: program.imgUrl,
			videoUrl: "",
		};
	}
	return null;
}

const KEYWORDS: [RegExp, string[]][] = [
	[/niệm phật|niem phat/, ["niệm phật", "bát quan trai", "vãng sanh", "tịnh độ"]],
	[/vu lan|báo hiếu|tri ân/, ["vu lan", "báo hiếu", "tri ân", "cha mẹ"]],
	[/sám hối|sam hoi/, ["sám hối", "nghiệp chướng", "tịnh hóa", "địa tạng"]],
	[/huyết bồn|huyet bon/, ["huyết bồn", "kinh huyết bồn", "báo ân"]],
	[/phật đản|vesak/, ["phật đản", "đản sinh", "vesak"]],
	[/cầu an|dược sư/, ["cầu an", "dược sư", "tiêu tai"]],
	[/địa tạng/, ["địa tạng", "bồ tát"]],
];

const CATEGORY_OF: Record<string, string> = { "Cộng Tu": "cong-tu", "Khóa Lễ Truyền Thống": "khoa-le-truyen-thong", "Đại Lễ Sự Kiện": "dai-le-su-kien" };

/** Up to four live posts of Dòng chảy hoằng pháp that look like this event, best first; the newest fill the rest. */
export function relatedForEvent(event: Pick<ScheduleDetail, "title" | "category">, articles: HoangPhapArticle[], limit = 4): HoangPhapArticle[] {
	const title = event.title.toLowerCase();
	const keywords = KEYWORDS.filter(([pattern]) => pattern.test(title)).flatMap(([, words]) => words);
	const words = title.split(/\s+/).filter((w) => w.length >= 3);
	const scored = articles
		.map((art, index) => {
			const artTitle = art.title.toLowerCase();
			const artSummary = (art.summary || "").toLowerCase();
			let score = 0;
			for (const kw of keywords) {
				if (artTitle.includes(kw)) score += 12;
				if (artSummary.includes(kw)) score += 6;
			}
			for (const w of words) if (artTitle.includes(w)) score += 3;
			if (CATEGORY_OF[event.category] && art.category === CATEGORY_OF[event.category]) score += 4;
			return { art, index, score };
		})
		.sort((a, b) => b.score - a.score || (b.art.views || 0) - (a.art.views || 0) || a.index - b.index);
	const matched = scored.filter((s) => s.score > 0).map((s) => s.art);
	if (matched.length >= 3) return matched.slice(0, limit);
	const taken = new Set(matched.map((m) => m.id));
	return [...matched, ...articles.filter((a) => !taken.has(a.id)).slice(0, limit - matched.length)];
}

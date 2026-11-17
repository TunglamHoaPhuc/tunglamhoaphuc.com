// Small hand-made content for the tests of the import and of the d1 source.
import type { ImportContent } from "../../../src/db/import";
import type { StatueEntry } from "../../../src/libs/content/baoTuong";
import type { Area, Post } from "../../../src/libs/content/types";

export const B2 = "https://s2-cnv03.s3.us-east-005.backblazeb2.com";
export const WORDPRESS = "https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/07/x.jpg";

const image = (src: string) => ({ src, position: "center 20%" });

export function post(id: string, patch: Partial<Post> = {}): Post {
	return {
		id,
		slug: `bai-${id}`,
		title: `Bài ${id}`,
		subtitle: "",
		section: "dong-chay-hoang-phap",
		category: { slug: "cong-tu", name: "Cộng Tu" },
		author: "Ban Văn Hóa",
		publishedDate: "2026-10-17",
		views: 12,
		thumbnail: image(`${B2}/a/thumb.webp`),
		banner: image(`${B2}/a/thumb.webp`),
		summary: "Tóm tắt",
		galleryCount: 0,
		intro: "",
		contentHtml: "<p>Nội dung</p>",
		keywords: [{ keyword: "Địa Tạng", title: "Bồ Tát", description: "…" }],
		gallery: [],
		videos: [],
		...patch,
	};
}

export const area: Area = { id: "a1", slug: "tam-bao", name: "Tam Bảo", subtitle: "Đại Hùng Bảo Điện", temple: "tung-lam-hoa-phuc", cover: image(WORDPRESS), mapPos: { x: 50, y: 49 }, intro: "Giới thiệu", contentHtml: "" };

export function statue(id: string, patch: Partial<StatueEntry> = {}): StatueEntry {
	return {
		id,
		code: `TP${id}`,
		slug: `tuong-${id}_tp${id}`,
		name: `Tượng ${id}`,
		subtitle: "",
		areaCode: "tam_bao",
		main: true,
		image: image(`${B2}/s/${id}.webp`),
		href: `/bao-tuong/tuong-${id}`,
		assembly: { slug: "chu-phat", name: "Chư Phật Hải Hội" },
		cluster: "Hoa Nghiêm Tam Thánh",
		quote: null,
		art: [],
		text: "Lịch sử",
		...patch,
	};
}

export function content(patch: Partial<ImportContent> = {}): ImportContent {
	return {
		posts: [post("1"), post("2")],
		albums: new Map(),
		schedule: {
			events: [
				{
					id: "e1",
					slug: "cong-tu",
					title: "Cộng tu",
					subtitle: "",
					category: { slug: "cong-tu", name: "Cộng Tu" },
					start: "2026-12-01",
					end: "2026-12-03",
					times: [{ label: "Khai khóa", time: "07h30" }],
					location: "Chánh điện",
					description: "",
					notes: "",
					image: null,
					video: null,
				},
			],
			programs: [],
			themes: [{ month: 12, title: "Tháng 12", poster: `${B2}/p/12.webp`, lines: ["<b>Một</b> dòng"], author: "Thầy" }],
			quotes: [{ id: "q1", src: `${B2}/q/1.webp`, title: "Pháp ngữ" }],
		},
		about: [],
		tongChi: [],
		areas: [area],
		statues: [statue("1"), statue("2", { areaCode: "cong_thap", cluster: "" })],
		monks: [{ id: "khuong-viet", name: "Quốc sư Khuông Việt", lifespan: "933–1011", region: "Miền Bắc", sangha: "Tăng chúng", sect: "Tông Lâm Tế", era: "", subEra: "", avatar: `${B2}/m/k.webp`, dharmaQuote: "", bio: "", coordinates: { x: 48, y: 28 } }],
		...patch,
	};
}

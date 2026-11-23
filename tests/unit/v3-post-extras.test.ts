import assert from "node:assert/strict";
import { test } from "node:test";
import { toPostRecord } from "@/lib/v3-data";
import type { Post } from "@/lib/tlhp-content/types";

const base = {
	id: "p1",
	slug: "bai-thu",
	title: "Bài thử",
	subtitle: "",
	section: "tri-tue-phat-phap",
	category: { slug: "phap-am", name: "Pháp Âm" },
	author: "",
	publishedDate: "2026-11-01",
	views: 0,
	thumbnail: null,
	banner: null,
	summary: "",
	galleryCount: 0,
	intro: "",
	contentHtml: "<p>Nội dung</p>",
	keywords: [],
	videos: [],
	gallery: [],
} as unknown as Post;

test("hands the sound of a Pháp Âm post and the book of an Ấn Phẩm & Sách post to the page", () => {
	const record = toPostRecord({ ...base, extra: { audio: { src: "/anh-goc/media/cms/a/v1/am-thanh.mp3", duration: "12:34" }, youtubeId: null, book: { title: "Cuốn sách", author: "Tác giả", cover: "/anh-goc/media/cms/b/v1/bia.webp", link: "https://example.test/mua" } } } as Post);
	assert.ok(record.audio?.src.includes("/anh-goc/media/cms/a/v1/am-thanh.mp3"));
	assert.equal(record.audio?.duration, "12:34");
	assert.equal(record.sourceBook?.bookTitle, "Cuốn sách");
	assert.equal(record.sourceBook?.author, "Tác giả");
	assert.equal(record.sourceBook?.linkUrl, "https://example.test/mua");
	assert.ok(record.sourceBook?.coverImage.includes("/anh-goc/media/cms/b/v1/bia.webp"));
});

test("has neither when the post has none, and for a summary", () => {
	const none = toPostRecord({ ...base, extra: { audio: null, youtubeId: null, book: null } } as Post);
	assert.equal(none.audio, undefined);
	assert.equal(none.sourceBook, undefined);
	const summary = toPostRecord({ id: "p2", slug: "s", title: "t", subtitle: "", section: "tri-tue-phat-phap", category: { slug: "x", name: "X" }, author: "", publishedDate: "2026-11-01", views: 0, thumbnail: null, banner: null, summary: "", galleryCount: 0 } as never);
	assert.equal(summary.audio, undefined);
});

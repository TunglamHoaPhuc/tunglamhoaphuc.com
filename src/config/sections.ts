// The sections of posts that have pages of their own: where they live and what their list
// says of them. Their list and article pages are the same pages (PostListPage, PostArticle).

export type PostSection = {
	/** The section of the posts file, which is also the path: "dong-chay-hoang-phap". */
	slug: string;
	path: string;
	name: string;
	/** Under the title of the list, and its meta description. */
	description: string;
};

export const DONG_CHAY: PostSection = {
	slug: "dong-chay-hoang-phap",
	path: "/dong-chay-hoang-phap",
	name: "Dòng Chảy Hoằng Pháp",
	description: "Tin hoạt động, khóa lễ, cộng tu và đại lễ tại Tùng Lâm Hòa Phúc.",
};

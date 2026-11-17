// Words of Tông Chỉ Tu Học that are not in the admin's data. The intro is the old
// /tong-chi-tu-hoc page's (written into its code); each group's line is that intro's own
// clause for it. Ban Truyền Thông may reword them here until T34 moves them into the admin.

export const tongChi = {
	title: "Tông Chỉ Tu Học",
	path: "/tong-chi-tu-hoc",
	intro: [
		"Tông chỉ tu học tại Tùng Lâm Hòa Phúc được hình thành trên nền tảng kế thừa tông phong của chư Tổ, với mong muốn xây dựng một lộ trình tu học rõ ràng, nhất quán và phù hợp cho mọi người phát tâm học Phật.",
		"Con đường ấy bắt đầu từ việc hiểu về nguồn cội tâm linh và truyền thống tu học, nuôi dưỡng Bồ-đề tâm làm gốc, lấy giới hạnh làm nền tảng, lấy các pháp môn hành trì làm phương tiện chuyển hóa, từng bước hình thành lộ trình tu học phù hợp với mỗi đối tượng và hướng đến một đời sống thiền gia thể hiện ngay trong lời nói, hành vi và cách ứng xử hằng ngày.",
		"Mỗi nội dung trong Tông chỉ tu học là một mắt xích của cùng một hành trình. Tất cả đều hướng đến mục tiêu chung là chuyển hóa thân tâm, nuôi dưỡng trí tuệ và từ bi, để Phật pháp trở thành chất liệu của đời sống hiện tại.",
		"Tùng Lâm Hòa Phúc mong rằng mỗi người khi bước vào hành trình này đều có thể tìm thấy con đường tu học phù hợp với chính mình, từng bước vun bồi đạo tâm và gìn giữ ngọn đèn Chánh pháp được truyền trao qua nhiều thế hệ.",
	],
	/** Each group's line, by group slug. Every group wears the icon of Tông Chỉ Tu Học, as on the old site. */
	groups: {
		"tong-phong-truyen-thua": { line: "Hiểu về nguồn cội tâm linh và truyền thống tu học." },
		"nen-tang-tu-hoc": { line: "Nuôi dưỡng Bồ-đề tâm làm gốc, lấy giới hạnh làm nền tảng." },
		"phuong-phap-hanh-tri": { line: "Lấy các pháp môn hành trì làm phương tiện chuyển hóa." },
		"lo-trinh-tu-hoc": { line: "Từng bước hình thành lộ trình tu học phù hợp với mỗi đối tượng." },
		"nep-song-thien-gia": { line: "Một đời sống thiền gia thể hiện ngay trong lời nói, hành vi và cách ứng xử hằng ngày." },
	} as Record<string, { line: string }>,
	// The lộ trình group, shown again on the home page as Bexon's process steps; its line is
	// the editors' own words from the Bồ Đề Tâm and Lộ Trình articles.
	paths: { group: "lo-trinh-tu-hoc", line: "Lựa chọn lộ trình phù hợp với hoàn cảnh và nhân duyên tu học của bạn." },
};

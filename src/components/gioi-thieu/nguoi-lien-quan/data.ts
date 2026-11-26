// The Tiểu sử Sư Tổ topic as the old site's page shows it: GIOI_THIEU_DETAILS['tieu-su-su-to'] of
// its src/data/gioi-thieu-data.ts (the page fell back to it while the live record lacked the
// 17/11/2026 rewrite, which is the case for this site's snapshot too), and its type.
export interface GioiThieuTopicDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  heroBanner: string;
  heroBannerPosition?: string;
  portraitImage: string;
  portraitImagePosition?: string;
  overviewSummary: string;
  quoteTitle: string;
  quoteContent: string[];
  quoteAuthor: string;
  milestones?: Array<{
    year: string;
    title: string;
    description: string;
  }>;
  mainContentHtml?: string;
  content?: string;
  galleryImages?: Array<{
    url: string;
    caption: string;
  }>;
  sourceBook?: {
    bookTitle: string;
    author: string;
    coverImage?: string;
    description?: string;
  };
  groupCategory?: string;
  groupCategoryName?: string;
  wpPostId?: string | number;
  wpModified?: string;
  status?: string;
  orderIndex?: number;
  relatedLinks?: Array<{
    title: string;
    href: string;
    tag: string;
  }>;
}


export const SU_TO_DETAIL: GioiThieuTopicDetail = {
	"id": "gt-05",
	"slug": "tieu-su-su-to",
	"title": "TIỂU SỬ SƯ TỔ NGỘ CHÂN TỬ",
	"subtitle": "Sư tổ khai sơn Tông phong Hoằng Pháp (1901 – 1988) – Ngọn đèn Tịnh Độ và tấm lòng Bồ Tát cứu khổ nhân gian",
	"tag": "Sư Tổ Khai Sơn",
	"heroBanner": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/hinh-su-to-final-19d1002.webp",
	"heroBannerPosition": "center 20%",
	"portraitImage": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/anh-hoa-thuong-tong-hop/nam/nam/Hoa-Thuong-Ngo-Chan-Tu.webp",
	"portraitImagePosition": "center 25%",
	"overviewSummary": "Cố Lão Hòa Thượng Ngộ Chân Tử là Sư Tổ khai sơn Tông phong Hoằng Pháp, Ngài có tầm ảnh hưởng rất lớn tại miền Bắc và các tỉnh miền Nam Việt Nam. Với hạnh nguyện độ sinh và tấm lòng Bồ-tát, Ngài đã xây dựng và trùng tu rất nhiều chùa chiền, kiến lập đạo tràng, xiển dương pháp môn Tịnh Độ, nuôi dạy cô nhi, cứu trợ người gặp khó khăn, làm từ thiện và thực hiện nhiều công tác xã hội ích nước lợi dân.",
	"quoteTitle": "DI HUẤN QUAN TRỌNG NHẤT",
	"quoteContent": [
		"Hãy tinh tấn tu hành, chuyên cần niệm Phật đừng để vọng niệm theo trần cảnh.",
		"Vẫn biết nhị đế phải dung thông, nhưng trong cái tùy duyên với muôn nghìn phương tiện thiện xảo ấy,",
		"các con đừng để bị nhận chìm trong tục đế mà phải như đóa sen thanh khiết nơi vùng bùn lầy nước đục.",
		"Tuy bất cứ hoàn cảnh hay trạng huống nào vẫn xứng đáng với con dòng họ Thích, đừng phản bội lại lý tưởng của chính mình."
	],
	"quoteAuthor": "Sư Tổ Ngộ Chân Tử (1901 - 1988)",
	"milestones": [
		{
			"year": "Năm 1901",
			"title": "Thân Thế & Nền Nếp Nho Gia",
			"description": "Sinh ngày 3/3 năm Tân Sửu (1901) tại thôn Cao Mại, xã Quang Hưng, huyện Kiến Xương, tỉnh Thái Bình; thế danh Trần Rinh. Thân phụ là cụ Trần Quán, thân mẫu là cụ Trần Thị Phược; Ngài là anh cả trong gia đình Nho phong gồm 5 anh em (3 trai, 2 gái) đều thuần thành hướng Phật."
		},
		{
			"year": "Năm 1919 (08/02 Kỷ Mùi)",
			"title": "Xuất Gia, Thọ Quy Giới & Đắc Pháp",
			"description": "Từ năm 13 tuổi được Sư tổ Quang Huy (Cụ Giáo Chức) dìu dắt tại chùa La Cao và giới thiệu ra Yên Tử tu tập; ngày 08/02 Kỷ Mùi (1919) gặp Tôn sư Hư Không Tử — bậc chân tu hành hạnh Độc giác du hóa tha phương — trao truyền quy giới & pháp danh Ngộ Chân Tử, rồi đắc pháp với Cụ Tổ chùa Bà Đá (Hà Nội)."
		},
		{
			"year": "1927 – 1932",
			"title": "Vân Du Cầu Đạo & Trùng Tu Già Lam Miền Bắc",
			"description": "Năm 1927 cùng song thân hiến đất xây lại chùa Tây Khánh tại Cao Mại; từ 1929–1932 vân du trùng tu nhiều cổ tự miền Bắc: Quan Âm (Kiến An), Úc Gián (Kiến Thụy), Quang Đẩu (An Lão), Kiền Bái, Côn Sơn, Đỗ Xá (Chí Linh), Phù Cốc và Khánh Vân (Thái Bình)."
		},
		{
			"year": "1935 – 1953",
			"title": "Sáng Lập Hoằng Pháp Kiến An, Viện Dục Anh & Phổ Chiếu",
			"description": "Sáng lập chùa Hoằng Pháp tại Kiến An, Hải Phòng (1935); mở Viện Dục Anh (1938) nuôi dạy trẻ mồ côi, dạy nghề tiểu thủ công nghiệp; đến năm 1953 tiếp tục khai sơn chùa Phổ Chiếu (Hải Phòng)."
		},
		{
			"year": "Năm Ất Dậu 1945",
			"title": "Bồ Tát Hạnh Giữa Nạn Đói Lịch Sử",
			"description": "Lập Viện Dục Anh và Viện Dưỡng Lão trực tiếp cứu đói đồng bào, tìm kiếm an táng người quá cố tử tế giữa nạn đói Ất Dậu 1945."
		},
		{
			"year": "1957 – 1974",
			"title": "Khai Sơn Tổ Đình Hoằng Pháp Hóc Môn",
			"description": "Mua đất tại Gia Định lập Tổ đình Hoằng Pháp (1957); nuôi dưỡng 361 nạn nhân Đồng Xoài (1965); lập Giáo hội Đạo Tràng Thiền Học & Viện Dục Anh Hóc Môn (1968); dự án Làng Cô nhi & Đền Hùng Vương Bình Chánh (1974)."
		},
		{
			"year": "Năm 1988 (16/10 ÂL)",
			"title": "An Nhiên Thị Tịch & Ngọn Đèn Tịnh Độ",
			"description": "An nhiên viên tịch lúc 13h30 ngày 24/11/1988 (16/10 Mậu Thìn) tại chùa Hoằng Pháp, trụ thế 88 năm, 65 hạ lạp. Hằng năm Tông phong trang nghiêm Lễ Giỗ Tổ tưởng niệm công đức khai sơn."
		}
	],
	"content": "### 1. Thân Thế, Quê Quán & Thời Niên Thiếu\n\n- **Thế danh:** Trần Rinh.\n- **Năm sinh:** Sinh ngày mùng 3 tháng 3 năm Tân Sửu (1901).\n- **Quê quán:** Thôn Cao Mại, xã Quang Hưng, huyện Kiến Xương, tỉnh Thái Bình.\n- **Thân phụ & Thân mẫu:** Thân phụ là cụ **Trần Quán** (gia phong Nho học, tu theo đạo Tam Giáo) và thân mẫu là cụ **Trần Thị Phược** — hai cụ đều là những Phật tử thuần thành quy y tại chốn tổ chùa La Cao (Tiền Hải, Thái Bình).\n- **Gia đình & Anh chị em:** Ngài là anh cả trong gia đình có năm anh em (3 trai, 2 gái) đều một lòng hướng Phật: người em trai thứ hai là cụ **Trần Đinh** cũng xuất gia tu học tại Hải Phòng; người em trai thứ ba là cụ **Trần Văn** ở lại quê hương phụng thờ hương hỏa nhưng giữ hạnh trường trai trọn đời; hai người em gái út là bà **Trần Thị Nhàn** và bà **Trần Thị Thanh** tuy ở tại gia vẫn phát nguyện tu hành thanh tịnh, không lập gia đình.\n- **Thuở thiếu thời & Sư tổ Quang Huy:** Sinh trưởng trong gia phong Nho học kết hợp nền nếp Phật đạo, Ngài sớm tinh thông Nho học. Khi trưởng thành và từ năm 13 tuổi sang chùa La Cao (Tiền Hải, Thái Bình) học đạo, Ngài được diện kiến **Sư tổ Quang Huy** — bậc cao đức tu theo môn phái Đại Đạo dung hợp Tam Giáo, được nhân dân Thái Bình kính trọng gọi là **Cụ Giáo Chức** (đệ tử đệ tôn rất đông tại khu vực Kiến Xương – Tiền Hải). Chính **Sư tổ Quang Huy** là vị hướng đạo đầu tiên dẫn dắt Ngài chuyển sang nghiên cứu Phật học và giới thiệu cho Ngài ra chùa Yên Tử tu tập. Khi chiêm nghiệm sâu sắc về thân phận con người giữa cõi vô thường, chí nguyện giải thoát trong Ngài càng kiên cố.\n- **Nhân duyên xuất gia với Tôn sư Hư Không Tử (08/02/Kỷ Mùi – 1919):** Sau một thời gian tầm sư học đạo, Ngài hội ngộ **Tôn sư Hư Không Tử** — bậc chân tu thoát tục thường du hóa tha phương, hành đạo theo hạnh Độc giác và chuyên giảng kinh hóa độ quần mê. Cảm mến lời giảng thanh thoát cùng dung mạo uy nghiêm của Tôn sư, Ngài mau chóng được cảm hóa; đến ngày mùng 8 tháng 2 năm Kỷ Mùi (1919), Ngài được Tôn sư trao truyền quy giới với pháp danh **Ngộ Chân Tử**, sau đó **đắc pháp với Cụ Tổ chùa Bà Đá** (Hà Nội), đồng thời theo Thầy hành cước chiêm bái các danh lam cổ tự và chốn tổ linh thiêng như Yên Tử, Côn Sơn, Tam Đảo, Tản Viên, Hương Tích, Chùa Thầy.\n\n### 2. Hành Đạo & Khai Sáng Chốn Tổ\n\n- **Trùng tu chùa chiền miền Bắc (1927 – 1932):** Năm 1927, cùng song thân hiến đất dựng lại chùa Tây Khánh (Cao Mại, Kiến Xương, Thái Bình), đặt nền móng cho mô hình Viện Dục Anh đầu tiên. Từ năm 1929 đến 1932, Ngài vân du trùng tu nhiều cổ tự miền Bắc như chùa Quan Âm (Kiến An), chùa làng Úc Gián (Kiến Thụy), chùa Quang Đẩu (An Lão), chùa Kiền Bái, chùa Côn Sơn, chùa Đỗ Xá (Chí Linh, Hải Dương), chùa Phù Cốc và chùa Khánh Vân (phủ Kiến Xương, Thái Bình).\n- **Sáng lập chùa Hoằng Pháp (Kiến An) & chùa Phổ Chiếu:** Năm 1935, Ngài sáng lập chùa Hoằng Pháp tại Kiến An (Hải Phòng); năm 1938 mở **Viện Dục Anh** nuôi dạy trẻ mồ côi và giúp đỡ đồng bào nghèo khó; năm 1953 tiếp tục sáng lập chùa **Phổ Chiếu** (Hải Phòng).\n- **Khai sơn Tổ đình Hoằng Pháp (Hóc Môn):** Sau khi vào Nam hành đạo từ năm 1955, đến năm 1957 Ngài mua đất tại Gia Định (nay là huyện Hóc Môn, TP.HCM), sáng lập Tổ đình Hoằng Pháp làm trung tâm hoằng truyền chánh pháp tại miền Nam.\n- **Thành lập Giáo hội Đạo Tràng Thiền Học:** Năm 1968, Ngài thành lập Giáo hội Đạo Tràng Thiền Học và mở Viện Dục Anh tại Hóc Môn, mở rộng phạm vi truyền bá giáo lý Tịnh Độ và Thiền tông.\n\n### 3. Công Tác Từ Thiện và Cứu Tế\n\n- **Cứu tế nạn đói năm 1945:** Thành lập Viện Dục Anh và Viện Dưỡng Lão, trực tiếp cứu tế đồng bào trong nạn đói lịch sử năm Ất Dậu 1945.\n- **Nuôi dưỡng nạn nhân chiến tranh:** Năm 1965, Ngài tiếp nhận nuôi dưỡng 361 nạn nhân chiến tranh tại Đồng Xoài, xây dựng trại định cư cho người dân nghèo.\n- **Kiến tạo Làng Cô nhi:** Năm 1974, Ngài tiến hành dự án xây dựng Làng Cô nhi và đền thờ Hùng Vương tại Bình Chánh.\n\n### 4. Kinh Sách Biên Soạn & Ấn Tống\n\nSư Tổ Ngộ Chân Tử đã trước tác, biên soạn và ấn tống nhiều bộ kinh sách sâu rộng cho đại chúng tu học, gồm 10 tác phẩm tiêu biểu:\n\n1) *Kinh Nhật Tụng* (soạn riêng cho chùa tụng đọc)\n2) *Nghi Luật Tu Trì Thiết Yếu*\n3) *Quy Giới Hành Trì*\n4) *Sự Tích Nhân Quả Báo Ứng*\n5) *Tuyên Dương Diệu Pháp*\n6) *Đạo Giải Thoát*\n7) *Tuyên Dương Chánh Pháp*\n8) *Trên Đường Hành Đạo*\n9) *Khóa Niệm Tùy Thân*\n10) *Lược Sử Phật Tổ*\n\n### 5. Tông Chỉ Tu Hành & Giờ Phút Viên Tịch\n\nSư Tổ luôn lấy Giới luật làm chánh niệm cho mọi hành động, tư duy và phát ngôn; lấy **Lục Tự Di Đà** *(Nam mô A Di Đà Phật)* làm cứu cánh cho việc thoát ly sinh tử; lấy **Lục Độ Vạn Hạnh** làm phương tiện cứu khổ chúng sinh.\n\nNăm 1988, do tuổi cao sức yếu, Ngài đã an nhiên thị tịch lúc 13 giờ 30 phút ngày 24 tháng 11 năm 1988 (nhằm ngày 16 tháng 10 năm Mậu Thìn) tại chùa Hoằng Pháp, trụ thế 88 năm và được 65 hạ lạp.\n\nHằng năm vào ngày 16 tháng 10 Âm lịch, chư Tăng Ni và Phật tử Tông phong Hoằng Pháp trên khắp cả nước đều trang nghiêm tổ chức lễ Giỗ Tổ để tưởng niệm công đức khai sơn vô lượng của Ngài.\n\nNgày 12 tháng 10 Âm lịch hằng năm, chư Tăng Tùng lâm Hòa Phúc cử hành Lễ Tưởng Niệm Sư Tổ Khai Sơn Viên Tịch đồng hiệp kị chư Lịch Đại Tổ Sư và cầu siêu cho chư vị Hương linh, đồng thời lấy ngày này là kỵ giỗ chung của Tăng chúng đang tu học tại Tùng lâm Hòa Phúc để tưởng niệm hướng về trong mai hậu.",
	"mainContentHtml": "### 1. Thân Thế, Quê Quán & Thời Niên Thiếu\n\n- **Thế danh:** Trần Rinh.\n- **Năm sinh:** Sinh ngày mùng 3 tháng 3 năm Tân Sửu (1901).\n- **Quê quán:** Thôn Cao Mại, xã Quang Hưng, huyện Kiến Xương, tỉnh Thái Bình.\n- **Thân phụ & Thân mẫu:** Thân phụ là cụ **Trần Quán** (gia phong Nho học, tu theo đạo Tam Giáo) và thân mẫu là cụ **Trần Thị Phược** — hai cụ đều là những Phật tử thuần thành quy y tại chốn tổ chùa La Cao (Tiền Hải, Thái Bình).\n- **Gia đình & Anh chị em:** Ngài là anh cả trong gia đình có năm anh em (3 trai, 2 gái) đều một lòng hướng Phật: người em trai thứ hai là cụ **Trần Đinh** cũng xuất gia tu học tại Hải Phòng; người em trai thứ ba là cụ **Trần Văn** ở lại quê hương phụng thờ hương hỏa nhưng giữ hạnh trường trai trọn đời; hai người em gái út là bà **Trần Thị Nhàn** và bà **Trần Thị Thanh** tuy ở tại gia vẫn phát nguyện tu hành thanh tịnh, không lập gia đình.\n- **Thuở thiếu thời & Sư tổ Quang Huy:** Sinh trưởng trong gia phong Nho học kết hợp nền nếp Phật đạo, Ngài sớm tinh thông Nho học. Khi trưởng thành và từ năm 13 tuổi sang chùa La Cao (Tiền Hải, Thái Bình) học đạo, Ngài được diện kiến **Sư tổ Quang Huy** — bậc cao đức tu theo môn phái Đại Đạo dung hợp Tam Giáo, được nhân dân Thái Bình kính trọng gọi là **Cụ Giáo Chức** (đệ tử đệ tôn rất đông tại khu vực Kiến Xương – Tiền Hải). Chính **Sư tổ Quang Huy** là vị hướng đạo đầu tiên dẫn dắt Ngài chuyển sang nghiên cứu Phật học và giới thiệu cho Ngài ra chùa Yên Tử tu tập. Khi chiêm nghiệm sâu sắc về thân phận con người giữa cõi vô thường, chí nguyện giải thoát trong Ngài càng kiên cố.\n- **Nhân duyên xuất gia với Tôn sư Hư Không Tử (08/02/Kỷ Mùi – 1919):** Sau một thời gian tầm sư học đạo, Ngài hội ngộ **Tôn sư Hư Không Tử** — bậc chân tu thoát tục thường du hóa tha phương, hành đạo theo hạnh Độc giác và chuyên giảng kinh hóa độ quần mê. Cảm mến lời giảng thanh thoát cùng dung mạo uy nghiêm của Tôn sư, Ngài mau chóng được cảm hóa; đến ngày mùng 8 tháng 2 năm Kỷ Mùi (1919), Ngài được Tôn sư trao truyền quy giới với pháp danh **Ngộ Chân Tử**, sau đó **đắc pháp với Cụ Tổ chùa Bà Đá** (Hà Nội), đồng thời theo Thầy hành cước chiêm bái các danh lam cổ tự và chốn tổ linh thiêng như Yên Tử, Côn Sơn, Tam Đảo, Tản Viên, Hương Tích, Chùa Thầy.\n\n### 2. Hành Đạo & Khai Sáng Chốn Tổ\n\n- **Trùng tu chùa chiền miền Bắc (1927 – 1932):** Năm 1927, cùng song thân hiến đất dựng lại chùa Tây Khánh (Cao Mại, Kiến Xương, Thái Bình), đặt nền móng cho mô hình Viện Dục Anh đầu tiên. Từ năm 1929 đến 1932, Ngài vân du trùng tu nhiều cổ tự miền Bắc như chùa Quan Âm (Kiến An), chùa làng Úc Gián (Kiến Thụy), chùa Quang Đẩu (An Lão), chùa Kiền Bái, chùa Côn Sơn, chùa Đỗ Xá (Chí Linh, Hải Dương), chùa Phù Cốc và chùa Khánh Vân (phủ Kiến Xương, Thái Bình).\n- **Sáng lập chùa Hoằng Pháp (Kiến An) & chùa Phổ Chiếu:** Năm 1935, Ngài sáng lập chùa Hoằng Pháp tại Kiến An (Hải Phòng); năm 1938 mở **Viện Dục Anh** nuôi dạy trẻ mồ côi và giúp đỡ đồng bào nghèo khó; năm 1953 tiếp tục sáng lập chùa **Phổ Chiếu** (Hải Phòng).\n- **Khai sơn Tổ đình Hoằng Pháp (Hóc Môn):** Sau khi vào Nam hành đạo từ năm 1955, đến năm 1957 Ngài mua đất tại Gia Định (nay là huyện Hóc Môn, TP.HCM), sáng lập Tổ đình Hoằng Pháp làm trung tâm hoằng truyền chánh pháp tại miền Nam.\n- **Thành lập Giáo hội Đạo Tràng Thiền Học:** Năm 1968, Ngài thành lập Giáo hội Đạo Tràng Thiền Học và mở Viện Dục Anh tại Hóc Môn, mở rộng phạm vi truyền bá giáo lý Tịnh Độ và Thiền tông.\n\n### 3. Công Tác Từ Thiện và Cứu Tế\n\n- **Cứu tế nạn đói năm 1945:** Thành lập Viện Dục Anh và Viện Dưỡng Lão, trực tiếp cứu tế đồng bào trong nạn đói lịch sử năm Ất Dậu 1945.\n- **Nuôi dưỡng nạn nhân chiến tranh:** Năm 1965, Ngài tiếp nhận nuôi dưỡng 361 nạn nhân chiến tranh tại Đồng Xoài, xây dựng trại định cư cho người dân nghèo.\n- **Kiến tạo Làng Cô nhi:** Năm 1974, Ngài tiến hành dự án xây dựng Làng Cô nhi và đền thờ Hùng Vương tại Bình Chánh.\n\n### 4. Kinh Sách Biên Soạn & Ấn Tống\n\nSư Tổ Ngộ Chân Tử đã trước tác, biên soạn và ấn tống nhiều bộ kinh sách sâu rộng cho đại chúng tu học, gồm 10 tác phẩm tiêu biểu:\n\n1) *Kinh Nhật Tụng* (soạn riêng cho chùa tụng đọc)\n2) *Nghi Luật Tu Trì Thiết Yếu*\n3) *Quy Giới Hành Trì*\n4) *Sự Tích Nhân Quả Báo Ứng*\n5) *Tuyên Dương Diệu Pháp*\n6) *Đạo Giải Thoát*\n7) *Tuyên Dương Chánh Pháp*\n8) *Trên Đường Hành Đạo*\n9) *Khóa Niệm Tùy Thân*\n10) *Lược Sử Phật Tổ*\n\n### 5. Tông Chỉ Tu Hành & Giờ Phút Viên Tịch\n\nSư Tổ luôn lấy Giới luật làm chánh niệm cho mọi hành động, tư duy và phát ngôn; lấy **Lục Tự Di Đà** *(Nam mô A Di Đà Phật)* làm cứu cánh cho việc thoát ly sinh tử; lấy **Lục Độ Vạn Hạnh** làm phương tiện cứu khổ chúng sinh.\n\nNăm 1988, do tuổi cao sức yếu, Ngài đã an nhiên thị tịch lúc 13 giờ 30 phút ngày 24 tháng 11 năm 1988 (nhằm ngày 16 tháng 10 năm Mậu Thìn) tại chùa Hoằng Pháp, trụ thế 88 năm và được 65 hạ lạp.\n\nHằng năm vào ngày 16 tháng 10 Âm lịch, chư Tăng Ni và Phật tử Tông phong Hoằng Pháp trên khắp cả nước đều trang nghiêm tổ chức lễ Giỗ Tổ để tưởng niệm công đức khai sơn vô lượng của Ngài.\n\nNgày 12 tháng 10 Âm lịch hằng năm, chư Tăng Tùng lâm Hòa Phúc cử hành Lễ Tưởng Niệm Sư Tổ Khai Sơn Viên Tịch đồng hiệp kị chư Lịch Đại Tổ Sư và cầu siêu cho chư vị Hương linh, đồng thời lấy ngày này là kỵ giỗ chung của Tăng chúng đang tu học tại Tùng lâm Hòa Phúc để tưởng niệm hướng về trong mai hậu.",
	"galleryImages": [
		{
			"url": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/su-to-ngo-chan-tu-thuo-moi-tu-hanh.webp",
			"caption": "Sư Tổ Ngộ Chân Tử lúc mới tu hành những năm đầu của thế kỷ 20"
		},
		{
			"url": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/su-to-ky-niem-ngay-sinh-hoa-phuc.webp",
			"caption": "Di ảnh thờ Sư Tổ trong Lễ Kỷ Niệm Ngày Sinh tại Tùng Lâm Hòa Phúc"
		},
		{
			"url": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/anh-hoa-thuong-tong-hop/nam/nam/Hoa-Thuong-Ngo-Chan-Tu.webp",
			"caption": "Chân dung lịch sử Hòa thượng Thích Ngộ Chân Tử (1901 – 1988)"
		},
		{
			"url": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/vien-duc-anh-xua-1943.webp",
			"caption": "Viện Dục Anh kỷ niệm Đệ Lục Chu Niên (1943) — Đạo sư Ngộ Chân Tử trình bày tiểu công nghệ"
		},
		{
			"url": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/ht-giac-tuong-he-phai-khat-si-tham-su-to.webp",
			"caption": "Hòa thượng Giác Tường và chư Tăng Hệ phái Khất Sĩ về thăm Sư Tổ"
		},
		{
			"url": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/cung-duong-truong-cao-cap-phat-hoc-1986.webp",
			"caption": "Sư Tổ cúng dường Trường Cao cấp Phật học năm 1986"
		},
		{
			"url": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/cung-duong-truong-ha-vinh-nghiem.webp",
			"caption": "Sư Tổ cúng dường Trường hạ Chùa Vĩnh Nghiêm, TP.HCM"
		},
		{
			"url": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/ky-niem-chu-ton-duc-thanh-kiem-tri-hai-su-to.webp",
			"caption": "Kỷ niệm chư Tôn đức HT. Thích Thanh Kiểm, HT. Thích Trí Hải, Sư Tổ và HT. Thích Trí Chơn"
		},
		{
			"url": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/bao-thap-nhi-nghiem-su-to.webp",
			"caption": "Bảo Tháp Nhị Nghiêm tôn trí nhục thân Sư Tổ tại Tổ đình Hoằng Pháp"
		},
		{
			"url": "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/gio-to-chua-hoang-phap-lan-35.webp",
			"caption": "Lễ Giỗ Tổ tại Tổ đình Hoằng Pháp lần thứ 35"
		}
	],
	"wpPostId": "24824"
};

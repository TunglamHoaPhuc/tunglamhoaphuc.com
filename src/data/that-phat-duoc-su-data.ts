// Bộ Thất Phật Dược Sư: tập tĩnh của V3 (D1 không có), tách ra từ statue-data.ts cũ. Dùng ở khối riêng của trang tượng Dược Sư (TP0018).

export interface ThatPhatDuocSuItem {
  id: string;
  code: string;
  name: string;
  titleName: string;
  subtitle: string;
  worldName: string;
  characterGroup: string;
  parentId: string;
  categoryType: 'NTPG';
  areaId: string;
  areaSlug: string;
  areaName: string;
  quote: string;
  quoteAuthor?: string;
  imgUrl: string;
  avatarUrl: string;
  description: string;
  fullHistoryHtml?: string;
}

export const THAT_PHAT_DUOC_SU_DATA: ThatPhatDuocSuItem[] = [
  {
    id: "TP_DS_01",
    code: "TP_DS_01",
    name: "ĐỨC PHẬT THIỆN DANH XƯNG CÁT TƯỜNG VƯƠNG NHƯ LAI",
    titleName: "ĐỨC PHẬT THIỆN DANH XƯNG CÁT TƯỜNG VƯƠNG NHƯ LAI",
    subtitle: "Quang Thắng Thế Giới • Ánh Sáng Tiêu Trừ Khổ Nạn",
    worldName: "Quang Thắng Thế Giới",
    characterGroup: "THAT_PHAT_DUOC_SU",
    parentId: "TP0018",
    categoryType: "NTPG",
    areaId: "DONG_PHUONG_TINH_DO",
    areaSlug: "dong-phuong-tinh-do",
    areaName: "Đông Phương Tịnh Độ",
    quote: "Vị Phật được ca ngợi, thường xuyên ca ngợi những điều thiện lành. Vị đó là vua của những điều lành.",
    quoteAuthor: "VÔ TRÍ - TÂM HÒA",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_thien_danh_xung_cat_tuong_vuong_nhu_lai.webp",
    avatarUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_thien_danh_xung_cat_tuong_vuong_nhu_lai.webp",
    description: "Đức Phật Thiện Danh Xưng Cát Tường Vương Như Lai ngự tại cõi Quang Thắng Thế Giới.",
    fullHistoryHtml: "<p>Đức Phật Thiện Danh Xưng Cát Tường Vương Như Lai ngự tại cõi Quang Thắng Thế Giới. Ngài phát 8 đại nguyện cứu độ chúng sinh khỏi khổ nạn, bệnh tật và nghèo khó.</p>",
  },
  {
    id: "TP_DS_02",
    code: "TP_DS_02",
    name: "ĐỨC PHẬT BẢO NGUYỆT TRÍ NGHIÊM QUANG ÂM TỰ TẠI VƯƠNG NHƯ LAI",
    titleName: "ĐỨC PHẬT BẢO NGUYỆT TRÍ NGHIÊM QUANG ÂM TỰ TẠI VƯƠNG NHƯ LAI",
    subtitle: "Diệu Bảo Thế Giới • Khai Mở Trí Tuệ",
    worldName: "Diệu Bảo Thế Giới",
    characterGroup: "THAT_PHAT_DUOC_SU",
    parentId: "TP0018",
    categoryType: "NTPG",
    areaId: "DONG_PHUONG_TINH_DO",
    areaSlug: "dong-phuong-tinh-do",
    areaName: "Đông Phương Tịnh Độ",
    quote: "Mặt trời trí tuệ của tự tính khi đã hiển lộ, không bị giới hạn.",
    quoteAuthor: "VÔ TRÍ - TÂM HÒA",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_bao_nguyet_tri_nghiem_quang_am_tu_tai_vuong_nhu_lai.webp",
    avatarUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_bao_nguyet_tri_nghiem_quang_am_tu_tai_vuong_nhu_lai.webp",
    description: "Đức Phật Bảo Nguyệt Trí Nghiêm Quang Âm Tự Tại Vương Như Lai ngự tại cõi Diệu Bảo Thế Giới.",
    fullHistoryHtml: "<p>Đức Phật Bảo Nguyệt Trí Nghiêm Quang Âm Tự Tại Vương Như Lai ngự tại cõi Diệu Bảo Thế Giới. Ngài phát 8 đại nguyện giúp chúng sinh tăng trưởng thiện căn, trí huệ sáng suốt.</p>",
  },
  {
    id: "TP_DS_03",
    code: "TP_DS_03",
    name: "ĐỨC PHẬT KIM SẮC BẢO QUANG DIỆU HẠNH THÀNH TỰU NHƯ LAI",
    titleName: "ĐỨC PHẬT KIM SẮC BẢO QUANG DIỆU HẠNH THÀNH TỰU NHƯ LAI",
    subtitle: "Viên Mãn Hương Tích • Chuyển Hóa Nghiệp Sát, Trộm, Sân",
    worldName: "Viên Mãn Hương Tích Thế Giới",
    characterGroup: "THAT_PHAT_DUOC_SU",
    parentId: "TP0018",
    categoryType: "NTPG",
    areaId: "DONG_PHUONG_TINH_DO",
    areaSlug: "dong-phuong-tinh-do",
    areaName: "Đông Phương Tịnh Độ",
    quote: "Tu tập là quá trình gạn đục khơi trong, vén mây gột rửa bớt trần cấu phiền não để mặt trời trí tuệ hiển bày.",
    quoteAuthor: "VÔ TRÍ - TÂM HÒA",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_kim_sac_bao_quang_dieu_hanh_thanh_tuu_nhu_lai.webp",
    avatarUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_kim_sac_bao_quang_dieu_hanh_thanh_tuu_nhu_lai.webp",
    description: "Đức Phật Kim Sắc Bảo Quang Diệu Hạnh Thành Tựu Như Lai ngự tại cõi Viên Mãn Hương Tích Thế Giới.",
    fullHistoryHtml: "<p>Đức Phật Kim Sắc Bảo Quang Diệu Hạnh Thành Tựu Như Lai ngự tại cõi Viên Mãn Hương Tích Thế Giới. Ngài phát 4 đại nguyện giúp chúng sinh dứt trừ nghiệp xấu ác, hướng thiện.</p>",
  },
  {
    id: "TP_DS_04",
    code: "TP_DS_04",
    name: "ĐỨC PHẬT VÔ ƯU TỐI THẮNG CÁT TƯỜNG VƯƠNG NHƯ LAI",
    titleName: "ĐỨC PHẬT VÔ ƯU TỐI THẮNG CÁT TƯỜNG VƯƠNG NHƯ LAI",
    subtitle: "Vô Ưu Thế Giới • Dứt Trừ Ưu Bi Khổ Não",
    worldName: "Vô Ưu Thế Giới",
    characterGroup: "THAT_PHAT_DUOC_SU",
    parentId: "TP0018",
    categoryType: "NTPG",
    areaId: "DONG_PHUONG_TINH_DO",
    areaSlug: "dong-phuong-tinh-do",
    areaName: "Đông Phương Tịnh Độ",
    quote: "Hạnh phúc là chạm đến, chứ không phải đi tìm. Con đường của hạnh phúc ta đã có, hãy nỗ lực bước đi.",
    quoteAuthor: "VÔ TRÍ - TÂM HÒA",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_vo_uu_toi_thang_cat_tuong_vuong_nhu_lai.webp",
    avatarUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/duc_phat_vo_uu_toi_thang_cat_tuong_vuong_nhu_lai.webp",
    description: "Đức Phật Vô Ưu Tối Thắng Cát Tường Vương Như Lai ngự tại cõi Vô Ưu Thế Giới.",
    fullHistoryHtml: "<p>Đức Phật Vô Ưu Tối Thắng Cát Tường Vương Như Lai ngự tại cõi Vô Ưu Thế Giới. Ngài phát 4 đại nguyện dứt trừ mọi sầu muộn, ưu bi của chúng sinh.</p>",
  },
  {
    id: "TP_DS_05",
    code: "TP_DS_05",
    name: "ĐỨC PHẬT PHÁP HẢI LÔI ÂM NHƯ LAI",
    titleName: "ĐỨC PHẬT PHÁP HẢI LÔI ÂM NHƯ LAI",
    subtitle: "Pháp Tràng Thế Giới • Chánh Kiến Chánh Tín Tam Bảo",
    worldName: "Pháp Tràng Thế Giới",
    characterGroup: "THAT_PHAT_DUOC_SU",
    parentId: "TP0018",
    categoryType: "NTPG",
    areaId: "DONG_PHUONG_TINH_DO",
    areaSlug: "dong-phuong-tinh-do",
    areaName: "Đông Phương Tịnh Độ",
    quote: "Giáo pháp không phải để cầu xin, mà phải khéo léo ứng dụng; không phải để nói suông, mà cần đi đến để thấy, biết.",
    quoteAuthor: "VÔ TRÍ - TÂM HÒA",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/phap_hai_loi_am_nhu_lai.webp",
    avatarUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/phap_hai_loi_am_nhu_lai.webp",
    description: "Đức Phật Pháp Hải Lôi Âm Như Lai ngự tại cõi Pháp Tràng Thế Giới.",
    fullHistoryHtml: "<p>Đức Phật Pháp Hải Lôi Âm Như Lai ngự tại cõi Pháp Tràng Thế Giới. Ngài phát 4 đại nguyện phá tan tà kiến mê lầm.</p>",
  },
  {
    id: "TP_DS_06",
    code: "TP_DS_06",
    name: "ĐỨC PHẬT PHÁP HẢI THẮNG HUỆ DU HÍ THẦN THÔNG NHƯ LAI",
    titleName: "ĐỨC PHẬT PHÁP HẢI THẮNG HUỆ DU HÍ THẦN THÔNG NHƯ LAI",
    subtitle: "Thiện Trụ Bảo Hải • Thần Thông Trí Huệ",
    worldName: "Thiện Trụ Bảo Hải Thế Giới",
    characterGroup: "THAT_PHAT_DUOC_SU",
    parentId: "TP0018",
    categoryType: "NTPG",
    areaId: "DONG_PHUONG_TINH_DO",
    areaSlug: "dong-phuong-tinh-do",
    areaName: "Đông Phương Tịnh Độ",
    quote: "Đừng bao giờ đi lùi trở lại mà phải đi tới, phải vượt qua những chướng nạn để đi đến con đường giải thoát.",
    quoteAuthor: "VÔ TRÍ - TÂM HÒA",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/phap_hai_thang_hue_du_hy_than_thong_nhu_lai.webp",
    avatarUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/phap_hai_thang_hue_du_hy_than_thong_nhu_lai.webp",
    description: "Đức Phật Pháp Hải Thắng Huệ Du Hí Thần Thông Như Lai ngự tại cõi Thiện Trụ Bảo Hải.",
    fullHistoryHtml: "<p>Đức Phật Pháp Hải Thắng Huệ Du Hí Thần Thông Như Lai ngự tại cõi Thiện Trụ Bảo Hải Thế Giới.</p>",
  },
  {
    id: "TP_DS_07",
    code: "TP_DS_07",
    name: "ĐỨC PHẬT DƯỢC SƯ LƯU LY QUANG VƯƠNG NHƯ LAI",
    titleName: "ĐỨC PHẬT DƯỢC SƯ LƯU LY QUANG VƯƠNG NHƯ LAI",
    subtitle: "Tịnh Lưu Ly Thế Giới • Đấng Y Vương Cứu Khổ",
    worldName: "Tịnh Lưu Ly Thế Giới",
    characterGroup: "THAT_PHAT_DUOC_SU",
    parentId: "TP0018",
    categoryType: "NTPG",
    areaId: "DONG_PHUONG_TINH_DO",
    areaSlug: "dong-phuong-tinh-do",
    areaName: "Tam Bảo (Đông Phương Tịnh Độ)",
    quote: "Khi làm chủ tâm sân, bệnh tật và đau khổ dần được chuyển hóa.",
    quoteAuthor: "VÔ TRÍ - TÂM HÒA",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/phat_duoc_su_luu_ly_quang_vuong_nhu_lai_tuong_chinh.webp",
    avatarUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/phat_duoc_su_luu_ly_quang_vuong_nhu_lai_tuong_chinh.webp",
    description: "Giáo chủ cõi Tịnh Lưu Ly phương Đông, bậc Y Vương chữa lành muôn bệnh khổ thân tâm.",
    fullHistoryHtml: "<p>Đức Phật Dược Sư Lưu Ly Quang Vương Như Lai là Giáo chủ cõi Tịnh Lưu Ly phương Đông.</p>",
  }
];

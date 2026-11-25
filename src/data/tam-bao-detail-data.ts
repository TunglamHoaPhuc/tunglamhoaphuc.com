export interface TamBaoStatue {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  imgUrl: string;
}

export interface TamBaoVideo {
  id: string;
  title: string;
  summary: string;
  thumbnailUrl: string;
  videoUrl: string;
  durationText: string;
  date: string;
  views: number;
}

export interface TamBaoSpaceImage {
  id: string;
  title: string;
  description: string;
  caption?: string;
  imgUrl: string;
  category: string;
}

export const TAM_BAO_STATUES: TamBaoStatue[] = [
  {
    id: "tb-1",
    title: "ĐỨC PHẬT THÍCH CA MÂU NI",
    subtitle: "Vô Thượng Năng Nhân",
    badge: "TƯỢNG CHÍNH",
    description: "Tôn tượng Đức Bản Sư Thích Ca Mâu Ni Phật tôn thờ tại Chánh Điện Tam Bảo Tùng Lâm Hòa Phúc.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_thich_ca/tuong_chinh/duc_phat_thich_ca_tuongchinh.webp"
  },
  {
    id: "tb-2",
    title: "ĐỨC PHẬT DƯỢC SƯ",
    subtitle: "Đấng Y Vương Cứu Khổ Bách Tính",
    badge: "TƯỢNG CHÍNH",
    description: "Đức Phật Dược Sư Lưu Ly Quang Vương Như Lai với 12 đại nguyện cứu độ, chữa lành bệnh tật thân tâm.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_phat_hai_hoi/duc_phat_duoc_su/phat_duoc_su_luu_ly_quang_vuong_nhu_lai_tuong_chinh.webp"
  },
  {
    id: "tb-3",
    title: "NHẬT QUANG BỒ TÁT",
    subtitle: "Ánh Sáng Soi Chiếu Thế Gian",
    badge: "TƯỢNG CHÍNH",
    description: "Nhật Quang Biến Chiếu Bồ Tát thị giả bên tả Đức Phật Dược Sư, chiếu sáng phá tan mọi tăm tối vô minh.",
    imgUrl: "/images/bao_tuong_phat_giao/thanh_tinh_dai_hai_chung/BO_TAT_NHAT_NGUYET_QUANG/nhat_nguyet_quang_bo_tat.JPG"
  },
  {
    id: "tb-4",
    title: "NGUYỆT QUANG BỒ TÁT",
    subtitle: "Ánh Sáng Soi Chiếu Thế Gian",
    badge: "TƯỢNG CHÍNH",
    description: "Nguyệt Quang Biến Chiếu Bồ Tát thị giả bên hữu Đức Phật Dược Sư, làm dịu mát mọi phiền não thế gian.",
    imgUrl: "/images/bao_tuong_phat_giao/thanh_tinh_dai_hai_chung/BO_TAT_NHAT_NGUYET_QUANG/nhat_nguyet_quang_bo_tat.JPG"
  },
  {
    id: "tb-5",
    title: "TỔ SƯ ĐẠT MA",
    subtitle: "Sơ Tổ Thiền Tông Trung Hoa",
    badge: "TỔ SƯ",
    description: "Bồ Đề Đạt Ma - Sơ Tổ Thiền Tông Tây Thiên Đông Độ truyền thừa mạch nguồn thiền đạo.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_lich_dai_to_su/to_su_dat_ma.webp"
  },
  {
    id: "tb-6",
    title: "TỔ SƯ LONG THỌ",
    subtitle: "Bắc Truyền Đại Thừa Sơ Tổ",
    badge: "TỔ SƯ",
    description: "Đại Bồ Tát Long Thọ khai sáng Trung Quán Tông, làm rạng rỡ tư tưởng Bát Nhã Đại Thừa.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_lich_dai_to_su/to_su_long_tho.webp"
  },
  {
    id: "tb-7",
    title: "PHẬT HOÀNG TRẦN NHÂN TÔNG",
    subtitle: "Sơ Tổ Thiền Phái Trúc Lâm",
    badge: "TỔ SƯ",
    description: "Đức vua hóa Phật, khai sáng dòng thiền Trúc Lâm Yên Tử đậm đà bản sắc tinh thần Đại Việt.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_lich_dai_to_su/phat_hoang_tran_nhan_tong.webp"
  },
  {
    id: "tb-8",
    title: "TỔ SƯ KHƯƠNG TĂNG HỘI",
    subtitle: "Sơ Tổ Phật Giáo Việt Nam",
    badge: "TỔ SƯ",
    description: "Bậc cao tăng truyền bá Phật giáo đầu tiên tại trung tâm Luy Lâu xứ Giao Châu.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_lich_dai_to_su/to_su_khuong_tang_hoi.webp"
  },
  {
    id: "tb-9",
    title: "SƯ TỔ NGỘ CHÂN TỬ",
    subtitle: "Khai Sáng Tổ Đình Hoằng Pháp",
    badge: "TỔ SƯ",
    description: "Cố Đại Lão Hòa Thượng khai sơn Tổ Đình Hoằng Pháp truyền thừa chánh pháp.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/chu_lich_dai_to_su/su_to_ngo_chan_tu.webp"
  },
  {
    id: "tb-10",
    title: "VI ĐÀ HỘ PHÁP",
    subtitle: "Vị Hộ Pháp Sau Ánh Sáng Giác Ngộ",
    badge: "HỘ PHÁP",
    description: "Tôn tượng Vi Đà Tôn Thiên Bồ Tát phát nguyện hộ trì chánh pháp và bảo vệ chốn già lam thanh tịnh.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/ho_phap_than_vuong/tuong_chinh/vi_da_ho_phap.webp"
  },
  {
    id: "tb-11",
    title: "NGÀI TRỪNG ÁC",
    subtitle: "Công Lý, Chính Nghĩa Và Sức Mạnh Bảo Vệ Tam Bảo",
    badge: "HỘ PHÁP",
    description: "Tôn tượng Hộ Pháp Trừng Ác biểu trưng cho sức mạnh hàng phục tà ma ngoại đạo.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/ho_phap_than_vuong/tuong_chinh/trung_ac.webp"
  },
  {
    id: "tb-12",
    title: "NGÀI KHUYẾN THIỆN",
    subtitle: "Lòng Từ Bi, Trí Tuệ Và Sự Khuyến Khích Điều Thiện",
    badge: "HỘ PHÁP",
    description: "Tôn tượng Hộ Pháp Khuyến Thiện biểu trưng cho lòng từ bi dẫn dắt chúng sinh quy hướng điều lành.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/ho_phap_than_vuong/tuong_chinh/khuyen_thien.webp"
  },
  {
    id: "tb-13",
    title: "THẬP NHỊ DƯỢC XOA ĐẠI TƯỚNG",
    subtitle: "Tượng Đồng Phỏng Cổ",
    badge: "HỘ PHÁP",
    description: "Mười hai vị Dược Xoa Đại Tướng hộ trì pháp môn Dược Sư và bảo hộ người tu học.",
    imgUrl: "/anh-goc/s2-cnv03/tunglamhoaphuc2/05-bao-tuong-phat-giao/ho_phap_than_vuong/tuong_chinh/thap_nhi_duoc_xoa/an_de_la_dai_tuong.webp"
  },
  {
    id: "tb-14",
    title: "ĐỨC ÔNG CẤP CÔ ĐỘC",
    subtitle: "Đại Nam Thí Chủ",
    badge: "ĐẠI THÍ CHỦ",
    description: "Trưởng giả Cấp Cô Độc - tấm gương hộ trì Tam Bảo mẫu mực, cúng dường Kỳ Viên Tịnh Xá.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/dai_thi_chu/duc_ong_cap_co_doc.webp"
  }
];

export const TAM_BAO_VIDEOS: TamBaoVideo[] = [
  {
    id: "vid-tb-1",
    title: "Câu Chuyện Về Khu Vực Tam Bảo - Tùng Lâm Hòa Phúc",
    summary: "Thước phim tư liệu ghi lại quá trình kiến tạo, ý nghĩa tâm linh và kiến trúc chữ Công độc đáo của Đại Hùng Bảo Điện Tùng Lâm Hòa Phúc.",
    thumbnailUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/01-trang-chu/-ai-le-Vu-Lan-Bao-Hieu-JPG.webp",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    durationText: "15:30",
    date: "15/08/2023",
    views: 12500
  }
];

export const TAM_BAO_SPACES: TamBaoSpaceImage[] = [
  {
    id: "sp-tb-1",
    title: "Khuôn Viên Chánh Điện Tam Bảo",
    description: "Không gian trang nghiêm thanh tịnh là nơi diễn ra các khóa tu tụng kinh bái sám.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/04-vu-tru-phat-giao/toan-canh-chua.webp",
    category: "CHÁNH ĐIỆN"
  },
  {
    id: "sp-tb-2",
    title: "Sân Thiền Hành Tam Bảo",
    description: "Khuôn viên tĩnh mịch cho chư Tăng và Phật tử thiền hành chánh niệm.",
    imgUrl: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/04-vu-tru-phat-giao/canh-1.webp",
    category: "SÂN THIỀN"
  }
];

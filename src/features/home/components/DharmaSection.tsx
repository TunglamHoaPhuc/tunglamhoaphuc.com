'use client';

import React, { FC } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, BookOpen, Compass, Waves } from 'lucide-react';
import { C } from '@/config/theme';
import type { SectionRef } from '@/features/home/types';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PostCard } from '@/components/common/PostCard';
import { SectionTransitionOverlay } from '@/components/common/SectionTransitionOverlay';
import { PostItem } from '@/types/post';

// ─── Bộ thẻ dự phòng: chỉ hiện khi máy chủ không đọc được bài nào từ D1 (không có số lượt xem để khỏi nói sai) ─────────────
const INITIAL_TOP_POSTS: PostItem[] = [
  {
    id: 'tc-4',
    imageUrl: '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/02-tong-chi-tu-hoc/tong-chi-tu-hoc-nen-tang-tu-hoc-bo-de-tam-herobanner-thumbnail.webp',
    category1: 'Tông Chỉ Tu Học',
    category2: 'NỀN TẢNG TU HỌC',
    category1Url: '/tong-chi-tu-hoc',
    category1IconUrl: '/images/icons/icon-tong-chi-tu-hoc-256.webp',
    title: 'BỒ ĐỀ TÂM — CỘI NGUỒN MỌI THIỆN PHÁP',
    subtitle: 'Nền tảng khởi đầu & động lực giác ngộ',
    description: 'Nền tảng khởi đầu và động lực tối thượng trên lộ trình tu học giác ngộ, xây dựng nếp sống tỉnh thức an lạc.',
    publishedDate: '',
    viewsCount: 0,
    targetUrl: '/tong-chi-tu-hoc/bo-de-tam-coi-nguon-thien-phap',
    thumbnailPosition: 'center 20%',
    imagePosition: 'center 20%',
  },
  {
    id: 'post-02',
    imageUrl: '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/01-trang-chu/Phap-hoi-niem-Phat.webp',
    category1: 'Dòng Chảy Hoằng Pháp',
    category2: 'HOẰNG PHÁP ĐỘ SINH',
    category1Url: '/dong-chay-hoang-phap',
    category1IconUrl: '/images/icons/icon-dong-chay-hoang-phap-128.webp',
    title: 'ĐẠI LỄ VU LAN BÁO HIẾU — THẮP SÁNG NGỌN ĐÈN TRI ÂN CHA MẸ',
    subtitle: 'Mùa báo hiếu thiêng liêng tri ân công đức',
    description: 'Mùa báo hiếu thiêng liêng trở về nguồn cội, nuôi dưỡng tình thương và sự tri ân công đức sinh thành dưỡng dục.',
    publishedDate: '',
    viewsCount: 0,
    targetUrl: '/dong-chay-hoang-phap/dai-le-vu-lan-bao-hieu-tri-an',
    thumbnailPosition: 'center 20%',
    imagePosition: 'center 20%',
  },
  {
    id: 'post-26827',
    imageUrl: '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/08-tu-an-book/page_01.webp',
    category1: 'Trí Tuệ Phật Pháp',
    category2: 'PHÁP ÂM & KHAI THỊ',
    category1Url: '/tri-tue-phat-phap',
    category1IconUrl: '/images/icons/icon-phap-am-128.webp',
    title: 'PHÁP ÂM CHỦ ĐỀ: “TU TẬP ĐÚNG CÁCH” — SA-MÔN VÔ TRÍ',
    subtitle: 'Chỉ dẫn điều phục thân tâm & chuyển hóa khổ đau',
    description: 'Chỉ dẫn tinh tế về phương pháp điều phục thân tâm, nhận diện chướng ngại và chuyển hóa khổ đau trong đời sống thường nhật.',
    publishedDate: '',
    viewsCount: 0,
    targetUrl: '/tri-tue-phat-phap/phap-am-chu-de-tu-tap-dung-cach-cong-tu-mot-ngay-an-lac',
    thumbnailPosition: 'center 20%',
    imagePosition: 'center 20%',
  },
  {
    id: 'tc-1',
    imageUrl: '/anh-goc/wordpress/2026/07/tong-chi-tu-hoc-tong-phong-truyen-thua-tiep-buoc-thay-toi-banner-thumnail-scaled.jpg',
    category1: 'Tông Chỉ Tu Học',
    category2: 'TÔNG PHONG TRUYỀN THỪA',
    category1Url: '/tong-chi-tu-hoc',
    category1IconUrl: '/images/icons/icon-tong-chi-tu-hoc-256.webp',
    title: 'TIẾP BƯỚC THẦY TÔI — NỐI NGUỒN TỔ ĐẠO',
    subtitle: 'Kính dâng bậc Ân Sư Sư Tổ Ngộ Chân Tử',
    description: 'Kính dâng bậc Ân Sư Sư Tổ Ngộ Chân Tử khai sơn chốn Tổ Hoằng Pháp, kế thừa mạng mạch chánh pháp ngàn đời.',
    publishedDate: '',
    viewsCount: 0,
    targetUrl: '/tong-chi-tu-hoc/tiep-buoc-thay-toi',
    thumbnailPosition: 'center 20%',
    imagePosition: 'center 20%',
  },
  {
    id: 'post-01',
    imageUrl: '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/01-trang-chu/Phap-hoi-niem-Phat.webp',
    category1: 'Dòng Chảy Hoằng Pháp',
    category2: 'CỘNG TU ĐỊNH KỲ',
    category1Url: '/dong-chay-hoang-phap',
    category1IconUrl: '/images/icons/icon-dong-chay-hoang-phap-128.webp',
    title: 'PHÁP HỘI NIỆM PHẬT & KHÓA LỄ BÁT QUAN TRAI GIỚI',
    subtitle: 'Ngày thanh tịnh trau dồi phạm hạnh',
    description: 'Ngày thanh tịnh trau dồi phạm hạnh, nhiếp tâm niệm Phật cầu an lạc cho muôn loài đệ tử tại gia.',
    publishedDate: '',
    viewsCount: 0,
    targetUrl: '/dong-chay-hoang-phap/phap-hoi-niem-phat-hang-tuan',
    thumbnailPosition: 'center 20%',
    imagePosition: 'center 20%',
  },
  {
    id: 'post-03',
    imageUrl: '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/08-tu-an-book/di-qua-kho-vui-cuoc-doi-bia-1.webp',
    category1: 'Trí Tuệ Phật Pháp',
    category2: 'TỦ SÁCH TỨ ÂN',
    category1Url: '/tri-tue-phat-phap',
    category1IconUrl: '/images/icons/icon-tri-tue-phat-phap-128.webp',
    title: "TÁC PHẨM 'ĐI QUA KHỔ VUI CUỘC ĐỜI' — THÍCH TÂM HÒA",
    subtitle: 'Hành trình tu tập & chiêm nghiệm nhân sinh',
    description: 'Tập văn ký hồi ức đúc kết hành trình tu tập, chiêm nghiệm nhân sinh và lòng tri ân sâu sắc đối với Tam Bảo cùng Thầy Tổ.',
    publishedDate: '',
    viewsCount: 0,
    targetUrl: '/tri-tue-phat-phap/tac-pham-di-qua-kho-vui-cuoc-doi',
    thumbnailPosition: 'center 20%',
    imagePosition: 'center 20%',
  },
];

type CategoryTab = 'all' | 'tong-chi' | 'dong-chay' | 'tri-tue';

interface TabItem {
  id: CategoryTab;
  label: string;
  shortLabel: string;
  icon: string;
  exploreUrl: string;
  exploreLabel: string;
}

const TABS: TabItem[] = [
  {
    id: 'all',
    label: 'TẤT CẢ TIÊU BIỂU',
    shortLabel: 'Tiêu Biểu',
    icon: '🌟',
    exploreUrl: '/dong-chay-hoang-phap',
    exploreLabel: 'Khám Phá Dòng Chảy Hoằng Pháp',
  },
  {
    id: 'tong-chi',
    label: 'TÔNG CHỈ TU HỌC',
    shortLabel: 'Tông Chỉ',
    icon: '🪷',
    exploreUrl: '/tong-chi-tu-hoc',
    exploreLabel: 'Khám Phá Toàn Bộ Tông Chỉ Tu Học',
  },
  {
    id: 'dong-chay',
    label: 'DÒNG CHẢY HOẰNG PHÁP',
    shortLabel: 'Hoằng Pháp',
    icon: '🌊',
    exploreUrl: '/dong-chay-hoang-phap',
    exploreLabel: 'Xem Toàn Bộ Dòng Chảy Hoằng Pháp',
  },
  {
    id: 'tri-tue',
    label: 'TRÍ TUỆ PHẬT PHÁP',
    shortLabel: 'Trí Tuệ',
    icon: '💡',
    exploreUrl: '/tri-tue-phat-phap',
    exploreLabel: 'Kho Tàng Trí Tuệ Phật Pháp',
  },
];

interface DharmaSectionProps {
  sectionRef?: SectionRef;
  /** Các bài đọc nhiều nhất (lượt xem thật từ D1), do trang chủ đọc ở máy chủ; thiếu thì dùng bộ thẻ dự phòng. */
  posts?: PostItem[] | null;
}

/**
 * 🪷 DẤU ẤN HOẰNG PHÁP
 * - Tiêu đề: Font 'UTM Niagara' vàng kim rực rỡ, phát sáng trang nghiêm
 * - Subtitle: Những bài viết được quan tâm & theo dõi nhiều nhất (tối giản, bỏ chữ kho tư liệu)
 * - Bố cục 5 bài viết:
 *   + 1 Post Card ảnh to nhất ở ngoài cùng (Featured Hero Card)
 *   + 4 Post Card xếp lưới 2x2 cân đối bên cạnh
 *   + Hover nhẹ nhàng mới hiển thị mô tả, ngày đăng và lượt xem
 */
const DharmaSection: FC<DharmaSectionProps> = ({ sectionRef, posts }) => {
  // Số lượt xem là của D1, đã có sẵn trong trang đầu tiên (không tải thêm từ trình duyệt).
  const topPosts = (posts?.length ? posts : INITIAL_TOP_POSTS).slice(0, 5);

  const featuredPost = topPosts[0];
  const sidePosts = topPosts.slice(1, 5);

  return (
    <section
      ref={sectionRef}
      id="hoang-phap"
      className="py-16 md:py-24 px-4 md:px-10 relative overflow-hidden bg-[#1A120B]"
    >
      {/* ── Seamless Gradient Blur Overlay ── */}
      <SectionTransitionOverlay position="both" />

      <div className="max-w-[1280px] mx-auto relative z-10">
        {/* ── Section Header (Tiêu đề font UTM Niagara) ── */}
        <SectionHeader
          title="DẤU ẤN HOẰNG PHÁP"
          subtitle="Những bài viết được quan tâm & theo dõi nhiều nhất"
          iconUrl="/images/icons/icon-dau-an-hoang-phap-160.webp"
        />

        {/* ── Bố cục 5 bài viết: 4 Thẻ 2x2 Bên Trái + 1 Post Card To Bên Phải (Tất cả chuẩn tỷ lệ 3:4) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-7 items-start">
          {/* 4 Card bên trái: Xếp lưới 2x2 cân đối (6 Cột Desktop, tỷ lệ 3:4) */}
          <div className="order-2 lg:order-1 lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
            {sidePosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {/* Card 1: ẢNH TO NHẤT CHUYỂN SANG BÊN PHẢI (6 Cột Desktop, tỷ lệ 3:4) */}
          {featuredPost && (
            <div className="order-1 lg:order-2 lg:col-span-6 flex flex-col">
              <PostCard
                post={featuredPost}
                large={true}
              />
            </div>
          )}
        </div>

        {/* ── Nút Khám Phá Toàn Bộ Dòng Chảy Hoằng Pháp ── */}
        <div className="mt-12 md:mt-16 flex items-center justify-center">
          <Link prefetch={false}
            href="/dong-chay-hoang-phap"
            className="group inline-flex items-center gap-2.5 px-6 md:px-8 py-3.5 rounded-full border border-[#F2C14E]/50 bg-[#2A1D14]/90 text-[#F2C14E] hover:text-[#2A1D14] hover:bg-[#F2C14E] transition-all duration-300 shadow-lg hover:shadow-[0_0_24px_rgba(242,193,78,0.5)] font-semibold text-xs md:text-sm tracking-wider uppercase"
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
          >
            <span>Khám Phá Dòng Chảy Hoằng Pháp</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default DharmaSection;

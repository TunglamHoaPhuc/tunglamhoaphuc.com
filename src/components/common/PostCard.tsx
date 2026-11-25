'use client';
import { fitImage } from '@/utils/image';
import { imageSources } from '@/lib/image-sources';
import { IMAGE_WIDTH } from '@/lib/tlhp-content/media';

import React, { FC } from 'react';
import Link from 'next/link';
import { Eye, Calendar, Sparkles } from 'lucide-react';
import { PostItem } from '@/types/post';

export interface PostCardProps {
  post: PostItem;
  large?: boolean;
  className?: string;
  variant?: 'portrait' | 'golden';
  /** Thẻ đầu danh sách (trên nếp gấp): tải ngay, không lazy. */
  priority?: boolean;
}

// Thẻ "golden" của danh sách Dòng Chảy: lưới 1 cột dưới 768 px (thẻ rộng 100vw trừ lề 16 px mỗi bên), 2 cột từ 768 px (lề 40 px mỗi bên,
// khoảng cách 40 px, trần 1.280 px nên thẻ rộng nhất 580 px). Trình duyệt chọn bậc 360/640/960/1280 theo bề rộng thẻ và mật độ điểm ảnh.
const GOLDEN_IMAGE_WIDTHS = [360, 640, 960, 1280] as const;
const GOLDEN_IMAGE_SIZES = '(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) calc((100vw - 120px) / 2), 580px';
const GOLDEN_FALLBACK_IMAGE = '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/01-trang-chu/Phap-hoi-niem-Phat.webp';

const DEFAULT_TEMPLE_LOGO = '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/02-tong-chi-tu-hoc/bieu-tuong-tong-chi-tu-hoc-tung-lam-hoa-phuc.webp';

/**
 * Tự động ánh xạ biểu tượng đặc trưng theo từng danh mục bài viết
 */
const getCategoryIcon = (category?: string, subCategory?: string, title?: string, explicitIcon?: string): string => {
  if (explicitIcon) return explicitIcon;
  const cat = (category || '').toLowerCase();
  const sub = (subCategory || '').toLowerCase();
  const t = (title || '').toLowerCase();

  // 1. Trí Tuệ Phật Pháp / Pháp Âm
  if (cat.includes('trí tuệ') || cat.includes('tri tue') || sub.includes('pháp âm') || sub.includes('phap am') || t.includes('pháp âm') || t.includes('phap am') || cat.includes('phap-am') || sub.includes('phap-am')) {
    if (sub.includes('pháp âm') || sub.includes('phap am') || t.includes('pháp âm') || t.includes('phap am') || sub.includes('phap-am')) {
      return '/images/icons/icon-phap-am-128.webp';
    }
    return '/images/icons/icon-tri-tue-phat-phap-128.webp';
  }

  // 2. Tông Chỉ Tu Học
  if (cat.includes('tông chỉ') || cat.includes('tong chi') || cat.includes('tong-chi') || cat.includes('tông phong') || cat.includes('bồ đề tâm')) {
    return '/images/icons/icon-tong-chi-tu-hoc-256.webp';
  }

  // 3. Dòng Chảy Hoằng Pháp (4 Chuyên Mục Con Đặc Trưng)
  // 3.1. Khóa Lễ Truyền Thống
  if (
    cat.includes('khoa-le-truyen-thong') ||
    sub.includes('khoa-le-truyen-thong') ||
    cat.includes('khóa lễ') ||
    cat.includes('khoa le') ||
    sub.includes('khóa lễ') ||
    sub.includes('khoa le') ||
    cat.includes('truyền thống') ||
    sub.includes('truyền thống') ||
    t.includes('địa tạng') ||
    t.includes('dia tang') ||
    t.includes('sám hối') ||
    t.includes('sam hoi')
  ) {
    return '/images/icons/icon-khoa-le-truyen-thong-128.webp';
  }

  // 3.2. Đại Lễ Sự Kiện
  if (
    cat.includes('dai-le-su-kien') ||
    sub.includes('dai-le-su-kien') ||
    cat.includes('đại lễ') ||
    cat.includes('dai le') ||
    sub.includes('đại lễ') ||
    sub.includes('dai le') ||
    cat.includes('sự kiện') ||
    sub.includes('sự kiện') ||
    t.includes('vu lan') ||
    t.includes('phật đản') ||
    t.includes('phat dan')
  ) {
    return '/images/icons/icon-dai-le-su-kien-128.webp';
  }

  // 3.3. Cộng Tu Định Kỳ
  if (
    cat.includes('cong-tu') ||
    sub.includes('cong-tu') ||
    cat.includes('cộng tu') ||
    sub.includes('cộng tu') ||
    t.includes('cộng tu') ||
    t.includes('niệm phật') ||
    t.includes('niem phat') ||
    t.includes('bát quan trai')
  ) {
    return '/images/icons/icon-cong-tu-128.webp';
  }

  // 3.4. Tịnh Độ Nhân Gian
  if (
    cat.includes('tinh-do-nhan-gian') ||
    sub.includes('tinh-do-nhan-gian') ||
    cat.includes('tịnh độ') ||
    sub.includes('tịnh độ') ||
    cat.includes('tinh do') ||
    sub.includes('tinh do') ||
    t.includes('tịnh độ') ||
    t.includes('tinh do')
  ) {
    return '/images/icons/icon-tinh-do-nhan-gian-128.webp';
  }

  // 3.5. Dòng Chảy Hoằng Pháp chung
  if (cat.includes('dòng chảy') || cat.includes('dong chay') || cat.includes('hoằng pháp') || cat.includes('hoang phap') || sub.includes('hoằng pháp')) {
    return '/images/icons/icon-dong-chay-hoang-phap-128.webp';
  }

  return DEFAULT_TEMPLE_LOGO;
};

/**
 * Standardized Golden Ratio Post Card (φ ≈ 1.618)
 * - Golden Thumbnail Aspect Ratio: aspect-[1.618/1]
 * - Golden Typography Scale:
 *   - Title: text-[18px] md:text-[20px] (Font UTM Avo Bold, Gold #F2C14E)
 *   - Summary: text-[13px] md:text-[14px] (Font UTM Avo Normal, Cream #D3C0AD)
 *   - Tag & Meta: text-xs md:text-[12px]
 * - Golden Padding & Spacing: p-4 md:p-6 (16px ~ 24px)
 * - Art Boundary Junction: 1px Gradient line + Floating Centered Temple Logo (z-20)
 */
export const PostCard: FC<PostCardProps> = ({
  post,
  large = false,
  className = '',
  variant = 'portrait',
  priority = false,
}) => {
  const CardWrapper = post.targetUrl ? Link : 'div';
  // prefetch={false}: một lưới có 12–24 thẻ, prefetch cả lưới ngay sau khi trang chạy tốn ~150 KB RSC; trang chi tiết tải khi bấm.
  const wrapperProps = post.targetUrl ? { href: post.targetUrl, prefetch: false } : {};

  const formattedViews =
    typeof post.viewsCount === 'number'
      ? post.viewsCount >= 1000
        ? `${(post.viewsCount / 1000).toFixed(1)}K`
        : post.viewsCount.toLocaleString('vi-VN')
      : post.viewsCount
        ? post.viewsCount.toString()
        : '0';

  const categoryTag = post.category1 || 'Phật Pháp – Đời Sống';
  const logoUrl = getCategoryIcon(post.category1, post.category2, post.title, post.category1IconUrl);
  // Huy hiệu 44-54 px: icon tĩnh của site (/images/icons/…-128.webp) giữ nguyên kèm ?v=4; icon do admin chọn hay logo ở /anh-goc/ (có thể là
  // PNG 2.000 px) đi bằng biến thể 160 px (một địa chỉ có ?v=4 thì không có biến thể).
  const badgeUrl = logoUrl.startsWith('/images/') ? `${logoUrl}?v=4` : fitImage(logoUrl, IMAGE_WIDTH.icon);

  if (variant === 'golden') {
    return (
      <CardWrapper
        {...(wrapperProps as any)}
        className={`group relative w-full aspect-[16/13] overflow-hidden rounded-xl border border-[#F2C14E]/25 bg-[#2C1C11] cursor-pointer transition-all duration-500 hover:-translate-y-1.5 hover:border-[#F2C14E] shadow-xl hover:shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex flex-col ${className}`}
      >
        {/* 1. Khung ảnh Thumbnail: flex-1 min-h-0 co lại mượt mà vào trong khi hover */}
        <div className="relative w-full flex-1 min-h-0 overflow-hidden bg-[#1A120B] transition-all duration-500 ease-out">
          <img width={640} height={520}
            {...imageSources(post.imageUrl || GOLDEN_FALLBACK_IMAGE, 640, GOLDEN_IMAGE_WIDTHS, GOLDEN_IMAGE_SIZES)}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            style={{ objectPosition: post.thumbnailPosition || post.imagePosition || 'center 20%' }}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* 2. Đường kẻ Gradient cắt ĐÚNG ranh giới mép chân ảnh */}
        <div className="relative w-full h-[1px] bg-gradient-to-r from-transparent via-[#F2C14E]/70 to-transparent z-10 shrink-0 transition-all duration-500 ease-out">
          {/* Huy hiệu Logo Chuyên mục con nổi chính giữa tim đường kẻ */}
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[44px] h-[44px] md:w-[50px] md:h-[50px] rounded-full border-2 border-[#F2C14E] bg-[#24160E] flex items-center justify-center p-2 shadow-[0_0_16px_rgba(242,193,78,0.6)] group-hover:scale-110 group-hover:shadow-[0_0_24px_rgba(242,193,78,0.85)] transition-all duration-300">
            <img width={128} height={128} loading="lazy" decoding="async"
              src={badgeUrl}
              alt={post.title}
              className="w-full h-full object-contain filter drop-shadow-[0_0_6px_rgba(242,193,78,0.5)]"
            />
          </div>
        </div>

        {/* 3. Khung nội dung: Cố định khung, mở rộng vào trong, Sub tiêu đề ở trên nghiêng nhẹ & bold nhẹ */}
        <div className="p-3.5 sm:p-4 md:p-5 pt-7 sm:pt-8 md:pt-9 flex flex-col items-center text-center justify-end bg-[#2C1C11] shrink-0 transition-all duration-500 ease-out">
          {/* Sub Tiêu Đề - Đưa lên trên tiêu đề, viết thường, bold nhẹ & nghiêng */}
          {(post.subtitle || post.category2) && (
            <p
              style={{ fontFamily: "'UTM Avo', sans-serif" }}
              className="text-xs sm:text-xs md:text-[13px] text-[#E5A93C] font-medium italic normal-case line-clamp-1 leading-normal w-full text-center tracking-wide"
            >
              {post.subtitle || post.category2}
            </p>
          )}

          {/* Tiêu Đề Bài Viết - Đưa xuống dưới sub tiêu đề, BẮT BUỘC BOLD & IN HOA TOÀN BỘ */}
          <h3
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
            className="font-bold uppercase text-[17px] sm:text-[18px] md:text-[20px] text-[#F2C14E] group-hover:text-[#FFE5A3] line-clamp-2 leading-snug transition-colors w-full text-center mt-1"
          >
            {post.title}
          </h3>

          {/* Phần mở rộng khi hover vào trong post: Mô tả ngắn + Ngày đăng & Lượt xem */}
          <div
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
            className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-500 ease-out w-full"
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2 pt-2 md:pt-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                {/* Mô tả ngắn bài viết */}
                {post.description && (
                  <p
                    className="text-[#c9b896] leading-relaxed line-clamp-2 md:line-clamp-3 text-justify text-xs md:text-[12.5px]"
                  >
                    {post.description}
                  </p>
                )}

                {/* Meta: Ngày đăng + Lượt xem */}
                <div className={`flex items-center ${post.publishedDate ? 'justify-between' : 'justify-end'} text-xs md:text-[11px] text-[#A69383] pt-2 border-t border-[#F2C14E]/15 mt-0.5`}>
                  {post.publishedDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#F2C14E]/70" />
                      <span>{post.publishedDate}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span>{formattedViews}</span>
                    <Eye className="w-3.5 h-3.5 text-[#F2C14E]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardWrapper>
    );
  }

  return (
    <CardWrapper
      {...(wrapperProps as any)}
      className={`group relative w-full aspect-[3/4] overflow-hidden rounded-xl border border-[#F2C14E]/25 bg-[#2C1C11] cursor-pointer transition-all duration-500 hover:-translate-y-1.5 hover:border-[#F2C14E] shadow-xl hover:shadow-[0_12px_36px_rgba(0,0,0,0.6)] flex flex-col ${className}`}
    >
      {/* 1. Khung ảnh Thumbnail tỷ lệ 3:4 linh hoạt */}
      <div className="relative w-full flex-1 min-h-0 overflow-hidden bg-[#1A120B]">
        <img width={480} height={640}
          src={fitImage(post.imageUrl || '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/01-trang-chu/Phap-hoi-niem-Phat.webp', 640)}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          style={{ objectPosition: post.thumbnailPosition || post.imagePosition || 'center 20%' }}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* 2. Đường kẻ Gradient cắt ranh giới mép chân ảnh */}
      <div className="relative w-full h-[1px] bg-gradient-to-r from-transparent via-[#F2C14E]/70 to-transparent z-10 shrink-0">
        {/* Huy hiệu Logo Danh mục nổi chính giữa tim đường kẻ (Phóng to trang nghiêm, tròn trịa cân đối) */}
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[46px] h-[46px] md:w-[54px] md:h-[54px] rounded-full border-2 border-[#F2C14E] bg-[#24160E] flex items-center justify-center p-2 md:p-2.5 shadow-[0_0_16px_rgba(242,193,78,0.6)] group-hover:scale-110 group-hover:shadow-[0_0_24px_rgba(242,193,78,0.85)] transition-all duration-300">
          <img width={128} height={128} loading="lazy" decoding="async"
            src={badgeUrl}
            alt={categoryTag}
            className="w-full h-full object-contain filter drop-shadow-[0_0_6px_rgba(242,193,78,0.5)]"
          />
        </div>
      </div>

      {/* 3. Khung nội dung tối giản: Căn chính giữa danh mục & tiêu đề, khoảng cách thoáng đãng tuyệt đối không chạm vòng tròn */}
      <div className="p-3 md:p-4 pt-8 sm:pt-9 md:pt-11 flex flex-col items-center text-center justify-end bg-[#2C1C11] shrink-0">
        {/* Sub Tiêu Đề - Viết thường, bold nhẹ & nghiêng */}
        <div
          style={{ fontFamily: "'UTM Avo', sans-serif" }}
          className="text-xs sm:text-[11px] md:text-[12px] font-medium italic text-[#E5A93C] tracking-wide normal-case truncate w-full text-center"
        >
          {post.subtitle || categoryTag}
        </div>

        {/* Tiêu Đề Bài Viết - BẮT BUỘC BOLD & IN HOA TOÀN BỘ */}
        <h3
          style={{ fontFamily: "'UTM Avo', sans-serif" }}
          className={`font-bold uppercase ${
            large ? 'text-[17px] md:text-[20px]' : 'text-[13px] md:text-[15px]'
          } text-[#F2C14E] group-hover:text-[#FFE5A3] line-clamp-2 leading-snug transition-colors mt-1.5 w-full text-center`}
        >
          {post.title}
        </h3>

        {/* Phần mở rộng khi hover: Mô tả ngắn + Ngày đăng & Lượt xem */}
        <div
          style={{ fontFamily: "'UTM Avo', sans-serif" }}
          className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out"
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-1.5 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {/* Mô tả ngắn bài viết */}
              {post.description && (
                <p
                  className={`text-[#c9b896] leading-relaxed line-clamp-2 text-justify ${
                    large ? 'text-xs md:text-[13px] md:line-clamp-3' : 'text-xs md:text-[11px]'
                  }`}
                >
                  {post.description}
                </p>
              )}

              {/* Meta: Ngày đăng + Lượt xem */}
              <div className={`flex items-center ${post.publishedDate ? 'justify-between' : 'justify-end'} text-xs md:text-[10px] text-[#A69383] pt-1.5 border-t border-[#F2C14E]/15 mt-0.5`}>
                {post.publishedDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#F2C14E]/70" />
                    <span>{post.publishedDate}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span>{formattedViews}</span>
                  <Eye className="w-3 h-3 text-[#F2C14E]/70" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardWrapper>
  );
};

export default PostCard;

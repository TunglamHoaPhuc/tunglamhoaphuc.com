'use client';

// Những gì khung trang (đầu trang, chân trang, bảng điều hướng) cần từ D1 của www, do máy chủ đọc một lần ở bố cục gốc
// (lib/v3-chrome.ts) rồi đưa xuống đây để thành phần phía trình duyệt dùng, không phải mỗi thành phần tự gọi máy chủ.
import { createContext, useContext, type ReactNode } from 'react';
import type { ChromeContact, ChromeInfo, ChromeNavItem, ChromeNotice } from '@/lib/v3-menu';

/** Một khu vực đang hiển thị (cho bảng điều hướng Vũ Trụ Phật Giáo). */
export type ChromeArea = { id: string; slug: string; name: string; subtitle: string; pinNumber: number };

export type ChromeState = {
  areas: ChromeArea[];
  /** Menu đầu trang do admin sửa; `null` khi D1 chưa có mục nào (đầu trang dùng menu có sẵn của V3), `[]` khi không đọc được D1. */
  nav: ChromeNavItem[] | null;
  /** Số điện thoại chân trang do admin lưu; `null` khi D1 chưa có (chân trang dùng các dòng có sẵn), `[]` khi không đọc được D1. */
  contacts: ChromeContact[] | null;
  /** Tên, địa chỉ, giờ mở cửa, khẩu hiệu, liên kết bản đồ và mạng xã hội do admin lưu; `null` khi D1 chưa có thông tin trang. */
  info: ChromeInfo | null;
  /** Thông báo chào mừng do admin lưu (`site.announcement`): chưa lưu thì hộp giữ chữ có sẵn; tắt, để trống hay hết hạn thì không hiện. */
  notice: ChromeNotice;
};

export const EMPTY_CHROME: ChromeState = { areas: [], nav: null, contacts: null, info: null, notice: { state: 'absent' } };

const SiteChromeContext = createContext<ChromeState>(EMPTY_CHROME);

export function SiteChromeProvider({ value, children }: { value: ChromeState; children: ReactNode }) {
  return <SiteChromeContext.Provider value={value}>{children}</SiteChromeContext.Provider>;
}

export const useSiteChrome = () => useContext(SiteChromeContext);

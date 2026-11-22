'use client';

// Những gì khung trang (đầu trang, chân trang, bảng điều hướng) cần từ D1 của www, do máy chủ đọc một lần ở bố cục gốc
// (lib/v3-chrome.ts) rồi đưa xuống đây để thành phần phía trình duyệt dùng, không phải mỗi thành phần tự gọi máy chủ.
import { createContext, useContext, type ReactNode } from 'react';

/** Một khu vực đang hiển thị (cho bảng điều hướng Vũ Trụ Phật Giáo). */
export type ChromeArea = { id: string; slug: string; name: string; subtitle: string; pinNumber: number };

export type ChromeState = {
  areas: ChromeArea[];
};

export const EMPTY_CHROME: ChromeState = { areas: [] };

const SiteChromeContext = createContext<ChromeState>(EMPTY_CHROME);

export function SiteChromeProvider({ value, children }: { value: ChromeState; children: ReactNode }) {
  return <SiteChromeContext.Provider value={value}>{children}</SiteChromeContext.Provider>;
}

export const useSiteChrome = () => useContext(SiteChromeContext);

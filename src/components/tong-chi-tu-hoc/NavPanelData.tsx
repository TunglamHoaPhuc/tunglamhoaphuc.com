'use client';

// Danh sách bài cho bảng điều hướng (NavDropdownPanel): do máy chủ đọc từ D1 ở trang rồi đưa xuống qua đây, để thanh dưới đầu trang
// chỉ liệt kê bài đang hiển thị (không còn bản đóng gói). Trang nào có bảng Tông Chỉ hay Dòng chảy bọc nội dung bằng NavPanelProvider.
import { createContext, useContext, type ReactNode } from 'react';
import type { DongChayNavItem } from '@/data/dong-chay-hoang-phap-data';
import type { NavPanelGroup } from '@/lib/tong-chi-sections';

export interface NavPanelData {
  /** Các nhóm Tông Chỉ Tu Học cùng bài đang hiển thị của từng nhóm. */
  tongChi: NavPanelGroup[];
  /** Các bài Dòng chảy hoằng pháp mới nhất và tổng số bài đang hiển thị. */
  dongChay: { total: number; items: DongChayNavItem[] };
}

export const EMPTY_NAV_PANEL: NavPanelData = { tongChi: [], dongChay: { total: 0, items: [] } };

const NavPanelContext = createContext<NavPanelData>(EMPTY_NAV_PANEL);

export function NavPanelProvider({ data, children }: { data: Partial<NavPanelData>; children: ReactNode }) {
  return <NavPanelContext.Provider value={{ ...EMPTY_NAV_PANEL, ...data }}>{children}</NavPanelContext.Provider>;
}

export const useNavPanelData = () => useContext(NavPanelContext);

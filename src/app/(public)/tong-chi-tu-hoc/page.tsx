// Trang Tông Chỉ Tu Học: các bài đang hiển thị ở D1 của www, chia theo năm nhóm. Không còn lời gọi WordPress
// và không còn thẻ đóng gói sẵn: nhóm nào hết bài thì không hiện. Lời mở đầu là hằng số có chú thích (config/tong-chi.ts).
import { TONG_CHI_INTRO } from '@/config/tong-chi';
import { NavPanelProvider } from '@/components/tong-chi-tu-hoc/NavPanelData';
import { buildTongChiNavGroups, buildTongChiSections, introHtml, tongChiNavItems } from '@/lib/tong-chi-sections';
import { liveTongChiList } from '@/lib/v3-live';
import TongChiTuHocClient from './TongChiTuHocClient';

export const revalidate = 60;

export default async function TongChiTuHocPage() {
  const list = await liveTongChiList();
  const sections = buildTongChiSections(list);
  return (
    <NavPanelProvider data={{ tongChi: buildTongChiNavGroups(list) }}>
      <TongChiTuHocClient sections={sections} navItems={tongChiNavItems(sections)} introHtml={introHtml(TONG_CHI_INTRO)} />
    </NavPanelProvider>
  );
}

// The categories of Dòng chảy hoằng pháp as the list page offers them: the categories D1 has live posts in, with the names
// and the icons the editors gave them in the admin (not the four of the old site). Server side; the page hands the result to the client.
import { buildDongChayCategories, type DongChayCategoryInfo } from '@/data/dong-chay-hoang-phap-data';
import { liveCategoryIcons } from '@/lib/category-icons';
import { DONG_CHAY_SECTION } from '@/lib/dong-chay';
import { getContentRepository } from '@/lib/tlhp-content/repository';
import type { ContentRepository } from '@/lib/tlhp-content/types';
import type { D1Like } from '@/lib/tlhp-content/sources/d1';

export async function liveDongChayCategories(repo?: ContentRepository, db?: D1Like | null): Promise<DongChayCategoryInfo[]> {
  const live = await (repo ?? (await getContentRepository())).listCategories(DONG_CHAY_SECTION);
  return buildDongChayCategories(live, await liveCategoryIcons('post', DONG_CHAY_SECTION, db));
}

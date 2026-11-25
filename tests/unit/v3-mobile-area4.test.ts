// Tối ưu giao diện điện thoại 23/11/2026, vùng Tông Chỉ, Vũ Trụ Phật Giáo, Bảo tượng: quét mã nguồn, giữ các luật rẻ để không lùi lại.
//  1. không còn chiều cao theo vh/h-screen/w-screen (trên điện thoại vh là cỡ lớn nhất của khung nhìn, che mất đáy hộp thoại và bản đồ);
//  2. không còn chữ 9/10/11 px trần (mặc định điện thoại phải từ 12 px; cỡ nhỏ chỉ từ sm: trở lên);
//  3. nút đóng của hộp phóng to đủ 44 px trên điện thoại;
//  4. thanh phụ SubNavbar là lối điều hướng duy nhất trên điện thoại: không ẩn khi cuộn dưới md, có nút Mục lục, chừa chỗ cho logo đầu trang;
//  5. nội dung trang chi tiết không bị đẩy 48 px khi cuộn (thanh dọc chỉ có từ md);
//  6. lưới ảnh bento không có min-height ở dưới md (min-h × tỉ lệ 4/3 làm ô rộng hơn màn hình);
//  7. ảnh nền trang trí mờ là <img> bản nhỏ ưu tiên thấp; trang danh sách bảo tượng chỉ nhận trường nó dùng.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const AREA = [
  'src/app/(public)/tong-chi-tu-hoc',
  'src/app/(public)/vu-tru-phat-giao',
  'src/app/(public)/bao-tuong',
  'src/app/(public)/bao-tuong-phat-giao',
  'src/components/tong-chi-tu-hoc',
  'src/features/universe',
  'src/features/statues',
];

function walk(path: string): string[] {
  const full = join(ROOT, path);
  if (!existsSync(full)) return [];
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full).flatMap((name) => walk(`${path}/${name}`));
}

const files = AREA.flatMap(walk).filter((f) => f.endsWith('.tsx'));
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');
const lines = (f: string) => read(f).split(/\r?\n/);

test('vùng quét có tệp (đường dẫn đúng)', () => {
  assert.ok(files.length > 40);
});

test('không còn h-screen/w-screen/min-h-screen hay chiều cao vh (dùng svh/dvh)', () => {
  const bad: string[] = [];
  for (const f of files) {
    lines(f).forEach((line, i) => {
      // min-h-screen (nền trang) và w-screen (dải tràn mép, 100vw = bề rộng khung nhìn) không che gì: chỉ chặn chiều cao cố định theo vh.
      if (/[0-9]vh\b/.test(line) || /(^|[\s"'`:])(h|max-h)-screen\b/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('không còn chữ text-[9|10|11px] trần: cỡ nhỏ chỉ từ sm: trở lên', () => {
  const bad: string[] = [];
  for (const f of files) {
    lines(f).forEach((line, i) => {
      if (/(^|[^:\w-])text-\[(9|9\.5|10|11)px\]/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('nút đóng/chuyển ảnh của hộp phóng to có vùng chạm 44 px trên điện thoại', () => {
  const lightboxes = [
    'src/components/tong-chi-tu-hoc/chi-tiet/PhotoGallery.tsx',
    'src/features/universe/components/ArtisticStatueModal.tsx',
    'src/features/universe/components/SpaceGallerySection.tsx',
    'src/features/statues/components/BuddhistArtGallery.tsx',
    'src/features/statues/components/StatueDetailCoreLayout.tsx',
  ];
  for (const f of lightboxes) {
    const text = read(f);
    assert.ok(!/-translate-y-1\/2 w-9 h-9 rounded-xl/.test(text), `${f}: nút đóng còn 36 px`);
    assert.ok(!/z-30 w-10 h-10 rounded-full/.test(text), `${f}: nút trước/sau còn 40 px`);
    assert.ok(/w-11 h-11 sm:w-9 sm:h-9 rounded-xl/.test(text), `${f}: nút đóng chưa có w-11 h-11`);
  }
});

test('SubNavbar: giữ trên điện thoại, có Mục lục, chừa chỗ cho logo đầu trang, ẩn khi cuộn chỉ từ md', () => {
  const text = read('src/components/tong-chi-tu-hoc/SubNavbar.tsx');
  assert.ok(!/isScrolled \? 'opacity-0/.test(text), 'ẩn khi cuộn trên mọi màn hình');
  assert.ok(/md:opacity-0 md:-translate-y-full md:pointer-events-none/.test(text));
  assert.ok(/aria-label="Mục lục trang"/.test(text));
  assert.ok(/pl-\[9\.5rem\]/.test(text), 'thiếu chỗ chừa cho logo đầu trang (rộng đến 146 px)');
  assert.ok(/hidden md:flex flex-1/.test(text), 'dải chấm điều hướng ngang chỉ từ md');
  assert.ok(/sticky md:static/.test(text));
});

test('trang chi tiết không dịch nội dung 48 px khi cuộn trên điện thoại, và vùng bọc không giữ sticky bằng overflow-x-hidden', () => {
  for (const f of [
    'src/app/(public)/tong-chi-tu-hoc/[slug]/TongChiDetailClient.tsx',
    'src/app/(public)/vu-tru-phat-giao/[slug]/AreaDetailClient.tsx',
  ]) {
    const text = read(f);
    assert.ok(!/pl-16 md:pl-24/.test(text), `${f}: nội dung bị đẩy khi cuộn`);
    assert.ok(/isScrolled \? 'pl-4 md:pl-24'/.test(text), f);
    assert.ok(/overflow-x-clip md:overflow-x-hidden/.test(text), `${f}: overflow-x-hidden làm SubNavbar không dính`);
  }
});

test('lưới ảnh bento của PhotoGallery không có min-height dưới md', () => {
  const text = read('src/components/tong-chi-tu-hoc/chi-tiet/PhotoGallery.tsx');
  const body = text.slice(text.indexOf('const getBentoSpan'), text.indexOf('const getBentoSpan') + 1800);
  const classes = [...body.matchAll(/return '([^']+)'/g)].map((m) => m[1]);
  assert.ok(classes.length >= 8);
  for (const c of classes) {
    for (const token of c.split(' ')) {
      if (/min-h-\[/.test(token)) assert.ok(token.startsWith('md:'), `min-h không có tiền tố md: ${token}`);
    }
  }
});

test('ảnh nền trang trí mờ là <img> bản 640 ưu tiên thấp, không phải background-image 1280', () => {
  for (const f of [
    'src/app/(public)/bao-tuong-phat-giao/StatueListClient.tsx',
    'src/app/(public)/vu-tru-phat-giao/VuTruPhatGiaoClient.tsx',
  ]) {
    const text = read(f);
    assert.ok(!/backgroundImage/.test(text), `${f}: còn background-image`);
    assert.ok(/fetchPriority="low"/.test(text), f);
    assert.ok(/fitImage\(headerBgImage, 640\)/.test(text), f);
  }
  assert.ok(/fetchPriority="low"/.test(read('src/components/tong-chi-tu-hoc/SectionCarousel.tsx')));
});

test('trang danh sách bảo tượng chỉ truyền các trường danh sách dùng (không có lịch sử, thành viên cụm)', () => {
  const page = read('src/app/(public)/bao-tuong-phat-giao/page.tsx');
  assert.ok(/statues=\{records\.map\(toListItem\)\}/.test(page));
  assert.ok(!/fullHistoryHtml|clusterMembers|articleContent/.test(page.slice(page.indexOf('function toListItem'))));
});

test('lưới theo khu vực nạp bằng next/dynamic, không nhập tĩnh', () => {
  const text = read('src/app/(public)/vu-tru-phat-giao/[slug]/AreaDetailClient.tsx');
  for (const name of ['ThuVienGrid', 'DaiNamQuocMauGrid', 'DanhTangMap', 'GiangDuongPhapThoai', 'BaoTangGrid', 'TuAnFlipbook']) {
    assert.ok(!new RegExp(`import \\{ ${name} \\} from`).test(text), `${name} còn nhập tĩnh`);
    assert.ok(new RegExp(`const ${name} = dynamic\\(`).test(text), `${name} chưa dynamic`);
  }
  assert.ok(!/tam-bao-detail-data/.test(text), 'dữ liệu Tam Bảo nằm trong TamBaoStories');
});

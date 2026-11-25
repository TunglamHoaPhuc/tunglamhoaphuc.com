// Tối ưu ảnh 23/11/2026, vùng 3 (Bảo tượng và Vũ Trụ Phật Giáo): trang danh sách Bảo tượng nặng 30,8 MB HTML, thẻ rộng 378 px tải ảnh
// gốc 0,7 đến 1,2 MB, vòng tròn 116 px tải 1,16 MB. Bài kiểm này quét mã nguồn của vùng và giữ ba điều:
//  1. mọi <img>/<Image> hay background-image hiện ảnh /anh-goc/ đều đi qua fitImage()/fitProps() (biến thể đúng bậc), trừ danh sách cho phép bên dưới;
//  2. ảnh tải trước bằng `new Image()` cùng địa chỉ với thẻ hiển thị nó (không tải hai lần, không tải bản gốc);
//  3. trang danh sách: chỉ vài thẻ đầu tải ngay, thẻ còn lại lazy, kèm srcSet và sizes.
// Hành vi của fitProps()/swapOnError() được thử trực tiếp ở cuối.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  fitProps,
  swapOnError,
  STATUE_ICON,
  TOAN_CANH,
  TOAN_CANH_BACKDROP,
  bentoFit,
  CARD_WIDTHS,
} from '@/features/universe/image-props';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Vùng quét: Bảo tượng và Vũ Trụ Phật Giáo (trang, tính năng, thư viện). */
const AREA = [
  'src/app/(public)/bao-tuong-phat-giao',
  'src/app/(public)/bao-tuong',
  'src/app/(public)/vu-tru-phat-giao',
  'src/features/statues',
  'src/features/universe',
  'src/lib/statue-list.ts',
  'src/lib/v3-statues.ts',
  'src/lib/v3-areas.ts',
];

function walk(path: string): string[] {
  const full = join(ROOT, path);
  if (!existsSync(full)) return [];
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full).flatMap((name) => walk(`${path}/${name}`));
}

const sources = AREA.flatMap(walk)
  .filter((file) => /\.(tsx?|jsx?)$/.test(file))
  .map((file) => ({ file, text: readFileSync(join(ROOT, file), 'utf8') }));

/** Tên (hằng) trong image-props.ts mà giá trị đã là địa chỉ đi qua fitImage(): dùng thẳng trong `src={…}` hay `{...…}` là hợp lệ. */
const FITTED_CONSTANTS = [
  'STATUE_ICON_SRC',
  'STATUE_ICON_LARGE_SRC',
  'LOGO_ROUND_SRC',
  'TOAN_CANH_SRC',
  'TOAN_CANH_BACKDROP',
];

/** Thẻ ảnh JSX: từ `<img`/`<Image` đến `/>` (không thẻ nào của vùng có `/>` bên trong thuộc tính). */
function tags(text: string): string[] {
  return [...text.matchAll(/<(?:img|Image)\b[\s\S]*?\/>/g)].map((match) => match[0]);
}

const squash = (value: string) => value.replace(/\s+/g, ' ');

/** Nguồn của thẻ đã đi qua fitImage()/fitProps() hay hằng đã qua fitImage(). */
function isFitted(tag: string): boolean {
  if (/\{\.\.\.[^}]*fitProps\(/.test(tag)) return true;
  if (FITTED_CONSTANTS.some((name) => new RegExp(`\\{\\.\\.\\.${name}\\}`).test(tag))) return true;
  const src = /\bsrc=\{([\s\S]*?)\}\s*(?:\n|\/>|[a-zA-Z]+=)/.exec(tag)?.[1] ?? '';
  return /fitImage\(|fitProps\(/.test(src) || FITTED_CONSTANTS.includes(src.trim());
}

/** Tệp tĩnh trong public/ (/images, /brand): không phải ảnh R2, không có biến thể. */
const isStaticLiteral = (tag: string) => /\bsrc=["']\/(?:images|brand)\//.test(tag);

/**
 * Chỗ ĐƯỢC giữ nguyên địa chỉ ảnh, kèm lý do. Khóa: tệp + đoạn chữ duy nhất trong thẻ. Mục nào không còn khớp thẻ nào thì bài kiểm này
 * báo lỗi (danh sách không được để cũ).
 */
const RAW_IMG_ALLOWED: Array<{ file: string; snippet: string; reason: string }> = [
  {
    file: 'src/features/universe/components/BaoTangGrid.tsx',
    snippet: 'triển lãm sư tổ ngộ chân tử.JPG',
    reason:
      '<Image> tệp tĩnh /images/ trong public/ (không phải ảnh R2): không có biến thể, đi nguyên.',
  },
  {
    file: 'src/features/universe/components/QuanAm33Grid.tsx',
    snippet: 'GIEO THẺ QUAN ÂM LOGO.svg',
    reason: 'SVG tĩnh trong public/images/icon-minh-hoa: vector, không có biến thể.',
  },
];

test('every <img>/<Image> of Bảo tượng and Vũ Trụ goes through fitImage()/fitProps(), except the allow-list', () => {
  const bad: string[] = [];
  const used = new Set<number>();
  for (const { file, text } of sources) {
    for (const tag of tags(text)) {
      if (isFitted(tag) || isStaticLiteral(tag)) continue;
      const index = RAW_IMG_ALLOWED.findIndex(
        (entry) => entry.file === file && tag.includes(entry.snippet)
      );
      if (index >= 0) {
        used.add(index);
        continue;
      }
      bad.push(`${file}: ${squash(tag).slice(0, 140)}`);
    }
  }
  assert.deepEqual(bad, []);
  // Danh sách cho phép không được để cũ: mỗi mục phải còn khớp một thẻ thật.
  for (const [index, entry] of RAW_IMG_ALLOWED.entries()) {
    assert.ok(
      used.has(index) ||
        sources.some(
          ({ file, text }) =>
            file === entry.file &&
            tags(text).some((tag) => tag.includes(entry.snippet) && isStaticLiteral(tag))
        ),
      `allow-list entry is stale: ${entry.file} ${entry.snippet}`
    );
  }
});

test('every <img>/<Image> source of the area is a static file, a fitted constant or an expression with fitImage()/fitProps(), never a bare URL variable', () => {
  // Chặt hơn kiểm tra trên: một thẻ có fitProps() ở thuộc tính khác nhưng `src={x.imgUrl}` trần vẫn là lỗi.
  const bad: string[] = [];
  for (const { file, text } of sources) {
    for (const tag of tags(text)) {
      for (const match of tag.matchAll(/\bsrc=\{([^}]+)\}/g)) {
        const expr = match[1].trim();
        if (/fitImage\(|fitProps\(/.test(expr) || FITTED_CONSTANTS.includes(expr)) continue;
        if (/^['"]\/(?:images|brand)\//.test(expr)) continue;
        if (RAW_IMG_ALLOWED.some((entry) => entry.file === file && tag.includes(entry.snippet)))
          continue;
        bad.push(`${file}: src={${expr}}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('every background-image of the area with a picture uses fitImage() or a static file', () => {
  const bad: string[] = [];
  for (const { file, text } of sources) {
    for (const match of text.matchAll(/backgroundImage:\s*([^\n]*)/g)) {
      const value = match[1];
      if (!/url\(/.test(value)) continue; // gradient
      if (/fitImage\(/.test(value)) continue;
      if (/url\(['"]?\/(?:images|brand)\//.test(value)) continue;
      // `url('${name}')`: hợp lệ khi chính tệp này gán `const name = fitImage(…)`.
      const variable = /url\(['"]?\$\{(\w+)\}/.exec(value)?.[1];
      if (variable && new RegExp(`const ${variable} = fitImage\\(`).test(text)) continue;
      bad.push(`${file}: ${value.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('pictures preloaded with new Image() use the same fitted address as the <img> that shows them', () => {
  const bad: string[] = [];
  for (const { file, text } of sources) {
    if (!/new (?:window\.)?Image\(\)/.test(text)) continue;
    for (const match of text.matchAll(/^\s*\w+\.src = ([^;\n]+);/gm)) {
      if (!/fitImage\(/.test(match[1])) bad.push(`${file}: ${match[0].trim()}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the statue list: 2 eager cards at most, only in the first block, the others lazy; cards carry srcSet and sizes', () => {
  const file = 'src/app/(public)/bao-tuong-phat-giao/StatueListClient.tsx';
  const text = sources.find((source) => source.file === file)?.text ?? '';
  assert.ok(text, 'StatueListClient.tsx is in the scanned area');
  const eager = Number(/const FIRST_ROW_EAGER = (\d+);/.exec(text)?.[1]);
  assert.ok(eager >= 2 && eager <= 3, `first row eager count is 2 or 3, got ${eager}`);
  // Chỉ khối đầu của trang (nhóm đầu, lưới phẳng, hay khối nghệ thuật khi không có nhóm) được tải ngay.
  assert.match(text, /eager=\{index === 0 \? FIRST_ROW_EAGER : 0\}/);
  assert.match(text, /eager=\{layout\.groups\.length === 0 \? FIRST_ROW_EAGER : 0\}/);
  assert.match(text, /priority=\{index < eager\}/);
  assert.match(text, /loading=\{priority \? 'eager' : 'lazy'\}/);
  // Thẻ rộng 378 px: bậc 360/640/960 kèm sizes; không còn getImageUrl cho ảnh thẻ.
  assert.match(
    text,
    /fitProps\(statue\.imgUrl, \{ width: 960, widths: CARD_WIDTHS, sizes: CARD_SIZES \}\)/
  );
  assert.deepEqual([...CARD_WIDTHS], [360, 640, 960]);
  assert.match(text, /const CARD_SIZES = '[^']*calc\(100vw/);
});

test('fitProps(): variant at the standard width, srcSet and sizes only when the picture has variants', () => {
  const photo = '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/05-bao-tuong-phat-giao/a.webp';
  const props = fitProps(photo, { width: 960, widths: CARD_WIDTHS, sizes: '378px' });
  assert.equal(props.src, `${photo}@960`);
  assert.equal(props.srcSet, `${photo}@360 360w, ${photo}@640 640w, ${photo}@960 960w`);
  assert.equal(props.sizes, '378px');
  // 116 px avatar circle: 160 for DPR 1, 360 for DPR 2.
  assert.equal(
    fitProps(photo, { width: 360, widths: [160, 360], sizes: '120px' }).srcSet,
    `${photo}@160 160w, ${photo}@360 360w`
  );
  // Just the width, no srcSet: an icon.
  assert.deepEqual(fitProps(STATUE_ICON, { width: 160 }), { src: `${STATUE_ICON}@160` });
  // A picture outside the prefixes that have variants, a static file and an empty value come back as they are.
  assert.deepEqual(
    fitProps('/anh-goc/s2-cnv03/khac/a.jpg', { width: 960, widths: CARD_WIDTHS, sizes: '100vw' }),
    { src: '/anh-goc/s2-cnv03/khac/a.jpg' }
  );
  assert.deepEqual(
    fitProps('/images/hero/toan-canh-chua-1280.webp', {
      width: 960,
      widths: CARD_WIDTHS,
      sizes: '100vw',
    }),
    { src: '/images/hero/toan-canh-chua-1280.webp' }
  );
  assert.deepEqual(fitProps('', { width: 960 }), { src: '' });
  // The shared backdrop: toàn cảnh chùa at up to 1280.
  assert.equal(TOAN_CANH_BACKDROP.src, `${TOAN_CANH}@1280`);
  assert.equal(
    TOAN_CANH_BACKDROP.srcSet,
    `${TOAN_CANH}@640 640w, ${TOAN_CANH}@960 960w, ${TOAN_CANH}@1280 1280w`
  );
});

test('bentoFit(): a cell spanning the whole row gets up to 1920, a double cell 1280, a single cell 960', () => {
  assert.equal(bentoFit('col-span-1 sm:col-span-2 lg:col-span-4 row-span-1').width, 1920);
  assert.equal(bentoFit('col-span-1 sm:col-span-2 row-span-1').width, 1280);
  assert.equal(bentoFit('col-span-1 row-span-1').width, 960);
  assert.deepEqual(bentoFit('col-span-1 row-span-1').widths, [360, 640, 960]);
});

test('swapOnError(): replaces the picture and drops srcset/sizes (the browser prefers srcset over src), once', () => {
  const attrs = new Map<string, string>([
    ['srcset', 'a 360w'],
    ['sizes', '100vw'],
  ]);
  const img = {
    dataset: {} as Record<string, string>,
    src: 'a',
    removeAttribute: (name: string) => attrs.delete(name),
  };
  const handler = swapOnError('/images/hero/toan-canh-chua-1280.webp');
  handler({ currentTarget: img as unknown as HTMLImageElement });
  assert.equal(img.src, '/images/hero/toan-canh-chua-1280.webp');
  assert.equal(attrs.has('srcset'), false);
  assert.equal(attrs.has('sizes'), false);
  // The fallback failing too does not swap again (no loop).
  img.src = 'broken';
  handler({ currentTarget: img as unknown as HTMLImageElement });
  assert.equal(img.src, 'broken');
});

test('the scanned area exists (a rename must not silently empty this guard)', () => {
  assert.ok(
    sources.length >= 30,
    `scanned ${sources.length} files: ${sources
      .map((source) => relative(ROOT, join(ROOT, source.file)))
      .slice(0, 3)
      .join(', ')}…`
  );
  assert.ok(sources.some(({ file }) => file.endsWith('StatueListClient.tsx')));
  assert.ok(sources.some(({ file }) => file.endsWith('StatueDetailCoreLayout.tsx')));
  assert.ok(sources.some(({ file }) => file.endsWith('AreaDetailClient.tsx')));
});

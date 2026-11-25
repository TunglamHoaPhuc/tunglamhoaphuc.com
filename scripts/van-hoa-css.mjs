// Sinh src/components/van-hoa-viet-nam/van-hoa-tailwind.css: các lớp tiện ích Tailwind mà
// VanHoaScrollytelling.tsx dùng, biên dịch ra CSS tĩnh (trang chuyển từ web cũ dùng Tailwind, web này
// dùng Bootstrap + SCSS nên không có Tailwind trong dự án; CSS được biên dịch một lần ở đây rồi commit).
//   - chỉ nạp theme + utilities của Tailwind v4 (KHÔNG nạp Preflight; phần đặt lại nằm tay ở
//     van-hoa-story.css, trong .vh-root);
//   - mọi selector bị giới hạn trong .vh-root (cả chính .vh-root lẫn phần tử con), nên không lớp nào rò ra
//     ngoài trang này; :root/:host và `*` của Tailwind cũng chuyển vào .vh-root;
//   - mọi tiện ích là !important vì Bootstrap đặt cùng tên lớp với !important (p-4, gap-3, border, shadow,
//     text-center...); độ ưu tiên của `.vh-root .lớp` thắng được chúng;
//   - lớp tiện ích về chuyển động (transition-*, duration-*, animate-*) KHÔNG dùng: mọi chuyển động nằm ở
//     van-hoa-story.css, trong @media (prefers-reduced-motion: no-preference).
//
// Công cụ (không phải phụ thuộc của dự án): tailwindcss, @tailwindcss/postcss và postcss cài ở một thư mục riêng.
//   mkdir vh-tools && cd vh-tools && npm init -y && npm i tailwindcss@4.3.2 @tailwindcss/postcss@4.3.2 postcss@8
//   node scripts/van-hoa-css.mjs --from=<đường dẫn thư mục vh-tools>
// Chạy lại sau MỖI lần đổi tên lớp trong VanHoaScrollytelling.tsx.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fromArg = process.argv.find((arg) => arg.startsWith("--from="));
if (!fromArg) {
	console.error("Thiếu --from=<thư mục có node_modules/tailwindcss, @tailwindcss/postcss và postcss>");
	process.exit(1);
}
const from = path.resolve(fromArg.slice("--from=".length));
const requireTools = createRequire(path.join(from, "package.json"));
const postcss = requireTools("postcss");
const tailwind = requireTools("@tailwindcss/postcss");
const twVersion = requireTools("tailwindcss/package.json").version;

const SCOPE = ".vh-root";
const componentDir = path.join(root, "src/components/van-hoa-viet-nam");
const outFile = path.join(componentDir, "van-hoa-tailwind.css");
const tailwindDir = path.join(from, "node_modules/tailwindcss").replaceAll("\\", "/");

const input = `
@layer theme, utilities;
@import "${tailwindDir}/theme.css" layer(theme);
@import "${tailwindDir}/utilities.css" layer(utilities);
@source "${componentDir.replaceAll("\\", "/")}/VanHoaScrollytelling.tsx";
`;

const compiled = await postcss([tailwind({ base: componentDir, optimize: { minify: false } })]).process(input, {
	from: path.join(componentDir, "van-hoa-tailwind.input.css"),
});

const scoped = postcss.parse(compiled.css);

// Mọi tiện ích là !important (trừ biến tùy chỉnh --*).
scoped.walkAtRules("layer", (layer) => {
	if (layer.params !== "utilities" || !layer.nodes) return;
	layer.walkDecls((decl) => {
		if (!decl.prop.startsWith("--")) decl.important = true;
	});
});
scoped.walkAtRules("layer", (rule) => {
	if (rule.nodes) rule.replaceWith(rule.nodes);
	else rule.remove();
});

function scopeSelector(selector) {
	const s = selector.trim();
	if (s === ":root" || s === ":host" || s === "html" || s === "body") return [SCOPE];
	if (s === "*") return [SCOPE, `${SCOPE} *`];
	if (s.startsWith(":root") || s.startsWith(":host")) return [SCOPE + s.replace(/^:(root|host)/, "")];
	if (s.startsWith("::") || s.startsWith(":before") || s.startsWith(":after")) return [`${SCOPE} ${s}`];
	// Lớp tiện ích có thể nằm trên chính .vh-root (nó có relative, w-full, h-dvh...) hoặc trên phần tử con.
	if (s.startsWith(".")) return [`${SCOPE} ${s}`, `${SCOPE}${s}`];
	return [`${SCOPE} ${s}`];
}

scoped.walkRules((rule) => {
	const parent = rule.parent;
	if (parent?.type === "atrule" && /keyframes/.test(parent.name)) return;
	rule.selectors = [...new Set(rule.selectors.flatMap(scopeSelector))];
});

const header = `/* SINH RA bằng scripts/van-hoa-css.mjs từ các lớp trong VanHoaScrollytelling.tsx. KHÔNG sửa tay:
   đổi lớp trong tệp .tsx rồi chạy lại: node scripts/van-hoa-css.mjs --from=<thư mục vh-tools>
   Tailwind CSS v${twVersion} (MIT), chỉ theme + utilities (không Preflight), giới hạn trong .vh-root, mọi tiện ích !important. */
`;
const css = header + scoped.toString();
writeFileSync(outFile, css);
console.log(`van-hoa-tailwind.css: ${(css.length / 1024).toFixed(1)} KB (Tailwind ${twVersion})`);

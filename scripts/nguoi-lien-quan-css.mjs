// Builds src/components/gioi-thieu/nguoi-lien-quan/nguoi-lien-quan.css: the CSS of the pages of
// "Người Liên Quan" (the Odyssey view of Tiểu sử Sư Tổ and the detail layout of the other
// topics), ported from the old site (Next.js + Tailwind v4) with its Tailwind class names kept.
// Tailwind is not part of this site, so the CSS is compiled once here and committed:
//   - Tailwind v4 (theme, preflight, utilities) + tw-animate-css + the old page's own sheet,
//     with the old site's theme values (radius, border colour) that the page relies on;
//   - every rule scoped under #tlhp-nguoi-lien-quan, so nothing leaks into the rest of the site and the
//     page's rules win over the site's element rules (Bootstrap, Bexon, the dark theme);
//   - every utility !important, as Bootstrap sets many of the same class names with !important.
//
// Tailwind comes from the old site's node_modules (no new dependency here):
//   node scripts/nguoi-lien-quan-css.mjs --from=E:/tung-lam-hoa-phuc-old
// Run it again after changing class names in src/components/gioi-thieu/nguoi-lien-quan/*.tsx.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fromArg = process.argv.find((arg) => arg.startsWith("--from="));
if (!fromArg) {
	console.error("Thiếu --from=<thư mục web cũ có node_modules/tailwindcss>");
	process.exit(1);
}
const from = path.resolve(fromArg.slice("--from=".length));
const requireOld = createRequire(path.join(from, "package.json"));
const postcss = requireOld("postcss");
const tailwind = requireOld("@tailwindcss/postcss");

const SCOPE = "#tlhp-nguoi-lien-quan";
const componentDir = path.join(root, "src/components/gioi-thieu/nguoi-lien-quan");
const outFile = path.join(componentDir, "nguoi-lien-quan.css");
const pageSheet = readFileSync(path.join(componentDir, "nguoi-lien-quan-page.css"), "utf8");
const twAnimate = path.join(from, "node_modules/tw-animate-css/dist/tw-animate.css");

const tailwindDir = path.join(from, "node_modules/tailwindcss").replaceAll("\\", "/");
const input = `
@layer theme, base, utilities;
@import "${tailwindDir}/theme.css" layer(theme);
@import "${tailwindDir}/preflight.css" layer(base);
@import "${tailwindDir}/utilities.css" layer(utilities);
@import "${twAnimate.replaceAll("\\", "/")}";
@source "${componentDir.replaceAll("\\", "/")}";

/* The old site's theme (src/app/globals.css there) as far as the page uses it. */
@theme inline {
  --font-serif: 'Noto Serif', 'Playfair Display', Georgia, serif;
  /* var(--font-sans) of itself and an unset --font-geist-mono there: font-sans and font-mono
     come out invalid and the text keeps its inherited face (UTM Avo). The same here. */
  --font-sans: var(--tlhp-nlq-unset-font);
  --font-mono: var(--tlhp-nlq-unset-font);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
  --color-border: var(--border);
  --color-ring: var(--ring);
}
:root {
  --radius: 0.625rem;
  --border: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}
@layer base {
  * { border-color: var(--color-border); outline-color: color-mix(in oklab, var(--color-ring) 50%, transparent); }
}
${pageSheet}
`;

const compiled = await postcss([tailwind({ base: componentDir, optimize: { minify: false } })]).process(input, { from: path.join(componentDir, "nguoi-lien-quan.input.css") });

// Bootstrap (src/app/assets/css/bootstrap.min.css) sets many of the same class names with
// !important (p-4, gap-3, border, text-white, shadow-lg, …), and with them other properties (the
// border colour of .border): only !important utilities scoped under the id can beat those. So
// every utility is !important, as Tailwind's own `important` option makes them. Inline styles
// lose to them: the components keep no inline style on a property one of their classes sets.
function scopeSelector(selector) {
	const s = selector.trim();
	if (s === ":root" || s === ":host" || s === "html" || s === "body") return SCOPE;
	// Rules about the site's frame around the page (the LED mode hides the header; the smoothed
	// content box must not hold the page's fixed parts) stay as written.
	if (s.startsWith("body.odyssey-led-fullscreen") || s.startsWith("#smooth-content")) return s;
	if (s.startsWith(":root")) return SCOPE + s.slice(":root".length);
	if (s === "*" || s.startsWith("::")) return `${SCOPE} ${s}`;
	return `${SCOPE} ${s}`;
}

const scoped = postcss.parse(compiled.css);
scoped.walkAtRules("layer", (layer) => {
	if (layer.params !== "utilities" || !layer.nodes) return;
	layer.walkDecls((decl) => {
		const keyframes = decl.parent?.parent;
		if (keyframes?.type === "atrule" && /keyframes/.test(keyframes.name)) return;
		if (!decl.prop.startsWith("--")) decl.important = true;
	});
});
scoped.walkAtRules("layer", (rule) => {
	if (rule.nodes) rule.replaceWith(rule.nodes);
	else rule.remove();
});
scoped.walkRules((rule) => {
	const parent = rule.parent;
	if (parent?.type === "atrule" && /keyframes/.test(parent.name)) return;
	rule.selectors = [...new Set(rule.selectors.map(scopeSelector))];
});

// Keyframe names are global: Tailwind's pulse and bounce would replace animate.css's (Bexon's
// .pulse, .bounce) on every page once this sheet is loaded. Prefix the ones the page did not name.
const renamed = new Map();
scoped.walkAtRules(/keyframes$/, (rule) => {
	if (rule.params.startsWith("odyssey-")) return;
	renamed.set(rule.params, `odyssey-tw-${rule.params}`);
	rule.params = `odyssey-tw-${rule.params}`;
});
if (renamed.size) {
	const names = new RegExp(`(^|[\\s,(])(${[...renamed.keys()].join("|")})(?=[\\s,)]|$)`, "g");
	scoped.walkDecls((decl) => {
		if (decl.prop === "animation" || decl.prop === "animation-name" || decl.prop.startsWith("--animate-")) {
			decl.value = decl.value.replace(names, (_, lead, name) => lead + renamed.get(name));
		}
	});
}

const header = `/* GENERATED by scripts/nguoi-lien-quan-css.mjs from the classes in this folder and nguoi-lien-quan-page.css.
   Do not edit by hand: edit nguoi-lien-quan-page.css or the components, then run the script again.
   Tailwind CSS v4 (MIT), tw-animate-css (MIT). Scoped to ${SCOPE}. */
`;
writeFileSync(outFile, header + scoped.toString());
console.log(`nguoi-lien-quan.css: ${(scoped.toString().length / 1024).toFixed(0)} KB`);

import { purgeCSSPlugin } from "@fullhuman/postcss-purgecss";

// T41a: drop the Bootstrap and animate.css rules nothing uses (233 KB and 54 KB before).
// Only these two vendor files: the Bexon/TLHP SCSS builds class names at run time
// (`is-${status}`, `tlhp-theme-${…}`) that a scan of the source cannot see.
const VENDOR_CSS = /[\\/](bootstrap\.min|animate\.min)\.css$/;

const purge = purgeCSSPlugin({
	content: ["src/**/*.{js,jsx,ts,tsx}"],
	keyframes: true,
	safelist: {
		standard: [
			// Bootstrap's JS (BootstrapWrapper) and wow.js add these while the page runs.
			/^(show|showing|hiding|fade|collapse|collapsing|collapsed|active|disabled|modal|offcanvas|dropdown|tooltip|popover|carousel|bs-)/,
			/^(animated|animate__)/,
			// Elements an editor's text can hold (sanitised HTML of the posts).
			/^(html|body|h[1-6]|p|a|ul|ol|li|dl|dt|dd|blockquote|figure|figcaption|table|caption|thead|tbody|tfoot|tr|th|td|img|svg|video|audio|iframe|hr|pre|code|kbd|samp|sub|sup|small|mark|abbr|b|strong|em|i|u|s|address|summary|details|button|input|select|textarea|label|fieldset|legend|progress|output|main|section|article|nav|header|footer|aside)$/,
		],
	},
});

/** Runs PurgeCSS on the two vendor files only. */
const purgeVendorCss = {
	postcssPlugin: "tlhp-purge-vendor-css",
	OnceExit(root, helpers) {
		if (!VENDOR_CSS.test(root.source?.input.file ?? "")) return;
		return purge.OnceExit(root, helpers);
	},
};

export default { plugins: [purgeVendorCss] };

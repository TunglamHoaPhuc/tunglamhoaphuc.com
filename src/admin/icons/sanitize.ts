// Cleans an SVG a person uploaded for a menu item or a category icon. It is an ALLOW-LIST: the text is read into
// a small tree, only the listed elements and attributes survive, every value is checked against a strict pattern,
// and the result is written out again from the tree, so nothing of the original markup is ever passed through.
// Runs on the Worker (no DOM): a hand-written reader, not DOMParser.
export const MAX_SVG_BYTES = 50 * 1024;

export class SvgRejected extends Error {}

const ELEMENTS = new Set(["svg", "g", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse", "title"]);
/** Elements whose content is not markup: when one is dropped, everything up to its end tag goes too. */
const RAW_TEXT = new Set(["script", "style"]);

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const NUMBERS = /^[-+0-9eE.,\s]*$/;
const COLOR_NAMES = new Set(
	"aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" "),
);

const isNumber = (value: string) => NUMBER.test(value.trim());
const isColor = (raw: string) => {
	const value = raw.trim();
	if (value === "none" || value.toLowerCase() === "currentcolor") return true;
	if (/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) return true;
	if (/^rgba?\(\s*\d{1,3}%?\s*[, ]\s*\d{1,3}%?\s*[, ]\s*\d{1,3}%?\s*(?:[,/]\s*(?:0|1|0?\.\d+|\d{1,3}%)\s*)?\)$/i.test(value)) return true;
	return COLOR_NAMES.has(value.toLowerCase());
};

/** What each allowed attribute may hold; a value that fails is dropped, not repaired. */
const ATTRIBUTES: Record<string, (value: string) => boolean> = {
	width: isNumber,
	height: isNumber,
	viewBox: (value) => /^\s*(?:[-+]?[\d.]+(?:[eE][-+]?\d+)?[\s,]+){3}[-+]?[\d.]+(?:[eE][-+]?\d+)?\s*$/.test(value) && value.trim().split(/[\s,]+/).every(isNumber),
	d: (value) => value.length <= 30_000 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]*$/.test(value),
	points: (value) => value.length <= 30_000 && NUMBERS.test(value),
	cx: isNumber,
	cy: isNumber,
	r: isNumber,
	rx: isNumber,
	ry: isNumber,
	x: isNumber,
	y: isNumber,
	x1: isNumber,
	x2: isNumber,
	y1: isNumber,
	y2: isNumber,
	fill: isColor,
	stroke: isColor,
	"stroke-width": isNumber,
	"stroke-linecap": (value) => ["butt", "round", "square"].includes(value),
	"stroke-linejoin": (value) => ["miter", "round", "bevel"].includes(value),
	opacity: (value) => isNumber(value) && Number(value) >= 0 && Number(value) <= 1,
	transform: (value) => value.length <= 300 && /^(?:\s*(?:translate|rotate|scale|matrix|skewX|skewY)\s*\([-+0-9eE.,\s]*\))+\s*$/.test(value),
	"fill-rule": (value) => ["nonzero", "evenodd"].includes(value),
	"clip-rule": (value) => ["nonzero", "evenodd"].includes(value),
};

type SvgNode = { tag: string; attrs: [string, string][]; children: SvgNode[]; text: string };

const TAG = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/y;
const ATTR = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const MAX_DEPTH = 12;
const MAX_NODES = 600;

function readAttributes(source: string): [string, string][] {
	const found: [string, string][] = [];
	const seen = new Set<string>();
	for (const match of source.matchAll(ATTR)) {
		const name = match[1];
		if (seen.has(name)) continue;
		seen.add(name);
		found.push([name, match[2] ?? match[3] ?? match[4] ?? ""]);
	}
	return found;
}

/** The attributes of one element that pass the allow-list. A value with an entity (&…;) is dropped: it could hide anything. */
function keep(tag: string, raw: [string, string][]): [string, string][] {
	const out: [string, string][] = [];
	for (const [name, value] of raw) {
		const check = ATTRIBUTES[name];
		if (!check || value.includes("&") || value.includes("<")) continue;
		if (tag !== "svg" && (name === "viewBox")) continue;
		if (!check(value)) continue;
		out.push([name, value.trim()]);
	}
	return out;
}

const escapeText = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function write(node: SvgNode): string {
	const attrs = node.attrs.map(([name, value]) => ` ${name}="${value}"`).join("");
	if (node.tag === "title") return node.text.trim() ? `<title>${escapeText(node.text.trim().slice(0, 200))}</title>` : "";
	const inner = node.children.map(write).join("");
	return inner ? `<${node.tag}${attrs}>${inner}</${node.tag}>` : `<${node.tag}${attrs}/>`;
}

/**
 * Returns the cleaned SVG (one <svg> root with the standard namespace, only allowed elements and attributes), or
 * throws SvgRejected with a message for the person when nothing valid can be made of the text.
 */
export function sanitizeSvg(input: string): string {
	if (typeof input !== "string" || !input.trim()) throw new SvgRejected("Chưa có nội dung SVG.");
	if (new TextEncoder().encode(input).length > MAX_SVG_BYTES) throw new SvgRejected("SVG lớn hơn 50 KB. Hãy dùng biểu tượng đơn giản hơn.");

	// The prolog, comments and doctype carry nothing the icon needs. CDATA and entity declarations are refused outright.
	let source = input.replace(/^\uFEFF/, "").replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
	source = source.replace(/<!DOCTYPE\s+svg[^>[]*>/i, "");
	if (/<!/.test(source) || /<\?/.test(source)) throw new SvgRejected("SVG chứa phần không được hỗ trợ (CDATA, DOCTYPE hoặc khai báo thực thể).");

	const roots: SvgNode[] = [];
	const stack: SvgNode[] = [];
	let count = 0;
	let index = 0;
	while (index < source.length) {
		const open = source.indexOf("<", index);
		const textEnd = open < 0 ? source.length : open;
		const between = source.slice(index, textEnd);
		const top = stack[stack.length - 1];
		if (between.trim()) {
			if (top?.tag === "title") top.text += between;
			else if (!top) throw new SvgRejected("SVG có chữ nằm ngoài thẻ <svg>.");
		}
		if (open < 0) break;
		TAG.lastIndex = open;
		const match = TAG.exec(source);
		if (!match) throw new SvgRejected("SVG không đọc được: thẻ bị hỏng hoặc thiếu dấu đóng.");
		index = TAG.lastIndex;
		const [, closing, rawName, rawAttrs, selfClosing] = match;
		const tag = rawName.toLowerCase();

		if (closing) {
			if (!ELEMENTS.has(tag)) continue;
			const last = stack.pop();
			if (!last || last.tag !== tag) throw new SvgRejected("SVG không đọc được: các thẻ đóng mở không khớp.");
			continue;
		}

		if (!ELEMENTS.has(tag) || (stack.length === 0 && tag !== "svg") || (tag === "svg" && stack.length > 0)) {
			// Not allowed here: it and everything inside it are dropped.
			if (stack.length === 0 && tag !== "svg" && !RAW_TEXT.has(tag) && !selfClosing) {
				throw new SvgRejected("Tệp không phải SVG: phần tử gốc phải là <svg>.");
			}
			if (selfClosing) continue;
			if (RAW_TEXT.has(tag)) {
				const end = source.toLowerCase().indexOf(`</${tag}`, index);
				if (end < 0) throw new SvgRejected("SVG không đọc được: thẻ không đóng.");
				const close = source.indexOf(">", end);
				index = close < 0 ? source.length : close + 1;
				continue;
			}
			let depth = 1;
			const same = new RegExp(`<(/?)${rawName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s/>])[^>]*?(/?)>`, "gi");
			same.lastIndex = index;
			for (let found = same.exec(source); found && depth > 0; found = same.exec(source)) {
				if (found[1]) depth--;
				else if (!found[2]) depth++;
				index = same.lastIndex;
			}
			if (depth > 0) throw new SvgRejected("SVG không đọc được: thẻ không đóng.");
			continue;
		}

		if (++count > MAX_NODES) throw new SvgRejected("SVG quá phức tạp (hơn 600 phần tử).");
		if (stack.length >= MAX_DEPTH) throw new SvgRejected("SVG lồng quá sâu.");
		const node: SvgNode = { tag, attrs: keep(tag, readAttributes(rawAttrs)), children: [], text: "" };
		const parent = stack[stack.length - 1];
		if (parent) {
			if (parent.tag === "title") throw new SvgRejected("SVG không đọc được: thẻ <title> chỉ chứa chữ.");
			parent.children.push(node);
		} else {
			if (roots.length) throw new SvgRejected("SVG chỉ được có một thẻ <svg> gốc.");
			roots.push(node);
		}
		if (!selfClosing) stack.push(node);
	}
	if (stack.length) throw new SvgRejected("SVG không đọc được: thẻ không đóng.");
	const root = roots[0];
	if (!root) throw new SvgRejected("Tệp không phải SVG: không có thẻ <svg>.");

	const get = (name: string) => root.attrs.find(([key]) => key === name)?.[1];
	let viewBox = get("viewBox");
	const width = get("width");
	const height = get("height");
	if (!viewBox) {
		if (!width || !height || Number(width) <= 0 || Number(height) <= 0) throw new SvgRejected("SVG thiếu viewBox (hoặc width và height) nên không biết vẽ ở cỡ nào.");
		viewBox = `0 0 ${width} ${height}`;
	}
	const [, , vw, vh] = viewBox.split(/[\s,]+/).map(Number);
	if (!(vw > 0) || !(vh > 0)) throw new SvgRejected("viewBox của SVG không hợp lệ.");
	root.attrs = [["xmlns", "http://www.w3.org/2000/svg"], ["viewBox", viewBox.trim().split(/[\s,]+/).join(" ")], ...root.attrs.filter(([name]) => name !== "viewBox")];
	const cleaned = write(root);
	if (!cleaned.startsWith("<svg ")) throw new SvgRejected("Không tạo được SVG hợp lệ.");
	return cleaned;
}

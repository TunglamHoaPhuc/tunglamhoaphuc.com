// Những dòng admin được thêm vào robots.txt (mục SEO > robots.txt): chỉ các luật Allow/Disallow đơn giản cho mọi robot, không
// gì khác. Chép từ src/libs/robotsExtra.ts của www; admin kiểm lúc lưu, V3 kiểm lại lúc đọc.
const LINE = /^(Allow|Disallow):[ \t]*(\/[A-Za-z0-9\-._~%/*$?=&]*)$/i;

export type RobotsExtra = { allow: string[]; disallow: string[] };

export type RobotsCheck = { ok: true; lines: string[]; value: RobotsExtra } | { ok: false; message: string };

export function parseRobotsExtra(raw: string): RobotsCheck {
	const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	if (lines.length > 50) return { ok: false, message: "Tối đa 50 dòng." };
	const value: RobotsExtra = { allow: [], disallow: [] };
	const clean: string[] = [];
	for (const [index, line] of lines.entries()) {
		const found = LINE.exec(line);
		if (!found || line.length > 200) return { ok: false, message: `Dòng ${index + 1} chưa đúng: chỉ nhận dạng "Disallow: /duong-dan" hoặc "Allow: /duong-dan".` };
		const kind = found[1].toLowerCase() === "allow" ? "allow" : "disallow";
		value[kind].push(found[2]);
		clean.push(`${kind === "allow" ? "Allow" : "Disallow"}: ${found[2]}`);
	}
	return { ok: true, lines: clean, value };
}

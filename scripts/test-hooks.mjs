// Móc nạp mô-đun cho `node --test`: Node 24 tự bỏ kiểu của tệp .ts, còn hai việc dự án cần thêm là
// đường dẫn `@/…` (tsconfig paths) và import không có đuôi tệp / tệp JSON. Không thêm thư viện nào.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const SUFFIXES = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx", "/index.js"];

function probe(base) {
	for (const suffix of SUFFIXES) {
		const file = base + suffix;
		if (existsSync(file) && statSync(file).isFile()) return file;
	}
	return null;
}

export async function resolve(specifier, context, next) {
	let base = null;
	if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
	else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:") && !context.parentURL.includes("node_modules")) {
		base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
	}
	const hit = base && probe(base);
	return next(hit ? pathToFileURL(hit).href : specifier, context);
}

export async function load(url, context, next) {
	if (url.endsWith(".json") && url.startsWith("file:")) {
		return { format: "module", shortCircuit: true, source: `export default ${readFileSync(fileURLToPath(url), "utf8")};` };
	}
	return next(url, context);
}

// Móc nạp mô-đun cho `node --test`: Node 24 tự bỏ kiểu của tệp .ts, còn những việc dự án cần thêm là đường dẫn
// `@/…` (tsconfig paths), import không có đuôi tệp, tệp JSON, và tệp .tsx (biên dịch bằng `typescript` có sẵn, để
// kiểm thử dựng thành phần phía máy chủ). `next/link` được thay bằng thẻ <a>. Không thêm thư viện nào.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const SUFFIXES = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx", "/index.js"];
const STUBS = { "next/link": path.join(ROOT, "tests/stubs/next-link.mjs") };

function probe(base) {
	for (const suffix of SUFFIXES) {
		const file = base + suffix;
		if (existsSync(file) && statSync(file).isFile()) return file;
	}
	return null;
}

export async function resolve(specifier, context, next) {
	if (STUBS[specifier]) return next(pathToFileURL(STUBS[specifier]).href, context);
	let base = null;
	if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
	else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:") && !context.parentURL.includes("node_modules")) {
		base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
	}
	const hit = base && probe(base);
	return next(hit ? pathToFileURL(hit).href : specifier, context);
}

export async function load(url, context, next) {
	if (url.startsWith("file:") && !url.includes("node_modules")) {
		if (url.endsWith(".json")) return { format: "module", shortCircuit: true, source: `export default ${readFileSync(fileURLToPath(url), "utf8")};` };
		if (url.endsWith(".tsx")) {
			const source = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
				compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
				fileName: fileURLToPath(url),
			}).outputText;
			return { format: "module", shortCircuit: true, source };
		}
	}
	return next(url, context);
}

"use client";

import { diffLines } from "diff";

const pretty = (value: unknown) => (value === null || value === undefined ? "" : JSON.stringify(value, null, 2));

/**
 * What changed between two JSON values, line by line: lines only in `before` are red with "−", lines only in `after` are green
 * with "+", the rest are plain. Colour is never the only sign (the sign and the screen-reader text say it too).
 */
export function JsonDiff({ before, after }: { before: unknown; after: unknown }) {
	const a = pretty(before);
	const b = pretty(after);
	if (!a && !b) return <p className="tq-muted">Dòng nhật ký này không ghi dữ liệu trước hoặc sau.</p>;
	const parts = diffLines(a, b);
	let key = 0;
	return (
		<pre className="tq-code" aria-label="So sánh dữ liệu trước và sau" style={{ margin: 0, overflowX: "auto", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
			{parts.flatMap((part) =>
				part.value
					.replace(/\n$/, "")
					.split("\n")
					.map((line) => {
						const mark = part.added ? "+" : part.removed ? "−" : " ";
						return (
							<span
								key={key++}
								style={{
									display: "block",
									padding: "0 6px",
									background: part.added ? "var(--tq-ok-soft)" : part.removed ? "var(--tq-danger-soft)" : "transparent",
									color: part.added ? "var(--tq-ok)" : part.removed ? "var(--tq-danger)" : "inherit",
								}}
							>
								<span aria-hidden="true">{mark} </span>
								<span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
									{part.added ? "thêm: " : part.removed ? "bỏ: " : ""}
								</span>
								{line}
							</span>
						);
					}),
			)}
		</pre>
	);
}

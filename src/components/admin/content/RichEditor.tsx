"use client";

// The article editor (TipTap 3). The toolbar follows the WAI-ARIA toolbar pattern: one tab stop, arrow keys move
// between buttons, every button has a Vietnamese label and says whether its format is on. Inserting a link, a
// picture, a sound or a video opens a small form under the toolbar (in the page flow, no pop-up).
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import { useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { MediaPicker } from "../media/MediaPicker";
import { Alert } from "../ui";
import { readingStats } from "./localDraft";
import { editorExtensions, FONT_FAMILIES, FONT_SIZES, LINE_HEIGHTS, type FigureAttrs, type QuoteVariant } from "./editorExtensions";

export type EditorValue = { html: string; json: JSONContent };

type Panel = null | "link" | "image" | "audio" | "video" | "table";

const SAFE_LINK = /^(https:\/\/[^\s]+|mailto:[^\s]+|\/(?!\/)[^\s]*|#[^\s]*)$/i;
const SAFE_AUDIO = /^(https:\/\/[^\s]+|\/anh-goc\/[^\s]+)$/i;

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
	return (
		<button
			type="button"
			className="tq-btn tq-btn--secondary tq-btn--small"
			aria-label={label}
			title={label}
			aria-pressed={active === undefined ? undefined : active}
			disabled={disabled}
			onMouseDown={(event) => event.preventDefault()}
			onClick={onClick}
			style={{ minWidth: 36, fontWeight: active ? 700 : 500, background: active ? "var(--tq-accent-soft)" : undefined, borderColor: active ? "var(--tq-accent)" : undefined }}
		>
			{children}
		</button>
	);
}

const Divider = () => <span aria-hidden="true" style={{ width: 1, alignSelf: "stretch", background: "var(--tq-line)", margin: "0 2px" }} />;

/** The toolbar's arrow-key movement: one button holds tabindex 0, the others -1. */
function onToolbarKey(event: KeyboardEvent<HTMLDivElement>) {
	const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
	if (!keys.includes(event.key)) return;
	const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
	const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
	if (at < 0) return;
	event.preventDefault();
	const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (at + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
	buttons.forEach((button, index) => (button.tabIndex = index === next ? 0 : -1));
	buttons[next].focus();
}

function onToolbarFocus(event: FocusEvent<HTMLDivElement>) {
	// Keep a single tab stop: the button that last had focus.
	const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
	const target = event.target as unknown as HTMLButtonElement;
	if (buttons.includes(target)) buttons.forEach((button) => (button.tabIndex = button === target ? 0 : -1));
}

function readToolbarState(current: Editor | null) {
	if (!current) return null;
	return {
		bold: current.isActive("bold"),
		italic: current.isActive("italic"),
		underline: current.isActive("underline"),
		strike: current.isActive("strike"),
		h2: current.isActive("heading", { level: 2 }),
		h3: current.isActive("heading", { level: 3 }),
		h4: current.isActive("heading", { level: 4 }),
		paragraph: current.isActive("paragraph"),
		bullet: current.isActive("bulletList"),
		ordered: current.isActive("orderedList"),
		task: current.isActive("taskList"),
		quote: current.isActive("blockquote", { variant: null }),
		kinh: current.isActive("blockquote", { variant: "kinh" }),
		tho: current.isActive("blockquote", { variant: "tho" }),
		link: current.isActive("link"),
		sub: current.isActive("subscript"),
		sup: current.isActive("superscript"),
		highlight: current.isActive("highlight"),
		alignLeft: current.isActive({ textAlign: "left" }),
		alignCenter: current.isActive({ textAlign: "center" }),
		alignRight: current.isActive({ textAlign: "right" }),
		alignJustify: current.isActive({ textAlign: "justify" }),
		fontFamily: (current.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
		fontSize: String(current.getAttributes("textStyle").fontSize ?? "").replace("px", ""),
		color: (current.getAttributes("textStyle").color as string | undefined) ?? "",
		lineHeight: (current.getAttributes("paragraph").lineHeight as string | undefined) ?? "",
		table: current.isActive("table"),
		figure: current.isActive("figureImage"),
		canUndo: current.can().undo(),
		canRedo: current.can().redo(),
	};
}

/**
 * Pasted from Word or Google Docs: drop what only that program needs (classes, ids, mso styles, conditional comments, fonts,
 * sizes in pt, empty spans) and keep structure, bold/italic/underline, alignment, headings, lists and tables.
 */
export function cleanPastedHtml(html: string): string {
	const doc = new DOMParser().parseFromString(html.replace(/<!--[\s\S]*?-->/g, ""), "text/html");
	doc.querySelectorAll("style, script, meta, link, xml, title").forEach((node) => node.remove());
	const ALIGNABLE = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "TD", "TH", "LI"]);
	for (const el of [...doc.body.querySelectorAll<HTMLElement>("*")].reverse()) {
		const align = el.style?.textAlign;
		const weight = el.style?.fontWeight;
		const italic = el.style?.fontStyle === "italic";
		const underline = (el.style?.textDecorationLine || el.style?.textDecoration || "").includes("underline");
		for (const name of [...el.getAttributeNames()]) if (name !== "href" && name !== "src" && name !== "alt" && name !== "colspan" && name !== "rowspan") el.removeAttribute(name);
		if (ALIGNABLE.has(el.tagName) && ["center", "right", "justify"].includes(align)) el.style.textAlign = align;
		if (el.tagName === "SPAN" || (el.tagName === "B" && weight === "normal")) {
			// Word and Docs mark emphasis on spans: rebuild it as real tags around the span's children, then drop the span.
			let inner: Node[] = [...el.childNodes];
			const wrap = (tag: string) => {
				const w = doc.createElement(tag);
				for (const child of inner) w.appendChild(child);
				inner = [w];
			};
			if (el.tagName === "SPAN" && (weight === "bold" || Number(weight) >= 600)) wrap("strong");
			if (italic) wrap("em");
			if (underline) wrap("u");
			el.replaceWith(...inner);
		}
	}
	doc.querySelectorAll("p:empty").forEach((node) => node.remove());
	return doc.body.innerHTML;
}

export function RichEditor({ initial, onChange, label = "Nội dung bài", readOnly = false }: { initial: JSONContent | string; onChange: (value: EditorValue) => void; label?: string; readOnly?: boolean }) {
	const [panel, setPanel] = useState<Panel>(null);
	const onChangeRef = useRef(onChange);
	useLayoutEffect(() => {
		onChangeRef.current = onChange;
	});

	const editor = useEditor({
		extensions: editorExtensions(),
		content: initial,
		editable: !readOnly,
		immediatelyRender: false,
		editorProps: {
			transformPastedHTML: cleanPastedHtml,
			attributes: {
				"aria-label": label,
				"aria-multiline": "true",
				role: "textbox",
				class: "tq-rich-content",
				style: "min-height: 360px; padding: 16px; outline: none;",
			},
		},
		onUpdate: ({ editor: current }) => onChangeRef.current({ html: current.getHTML(), json: current.getJSON() }),
	});

	// useEditorState only re-reads after a transaction, and a freshly mounted editor has had none: until then read the state directly,
	// or the toolbar would wait for the first keystroke and the editor would never appear.
	const live = useEditorState({ editor, selector: ({ editor: current }) => readToolbarState(current) });
	const state = live ?? readToolbarState(editor);

	if (!editor || !state) return <p className="tq-muted" role="status">Đang mở trình soạn thảo…</p>;

	const chain = () => editor.chain().focus();
	const toggle = (open: Panel) => setPanel((now) => (now === open ? null : open));

	function quote(variant: QuoteVariant) {
		const active = editor!.isActive("blockquote");
		const same = editor!.isActive("blockquote", { variant });
		if (active && same) chain().lift("blockquote").run();
		else if (active) chain().updateAttributes("blockquote", { variant }).run();
		else chain().wrapIn("blockquote", { variant }).run();
	}

	return (
		<div className="tq-panel" style={{ padding: 0 }}>
			<style>{CONTENT_CSS}</style>
			{readOnly ? null : (
				<div
					role="toolbar"
					aria-label="Định dạng nội dung"
					onKeyDown={onToolbarKey}
					onFocus={onToolbarFocus}
					style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 8, borderBottom: "1px solid var(--tq-line)", background: "var(--tq-ground)", position: "sticky", top: 0, zIndex: 2 }}
				>
					<ToolButton label="Hoàn tác (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
						↶
					</ToolButton>
					<ToolButton label="Làm lại (Ctrl+Y)" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
						↷
					</ToolButton>
					<Divider />
					<ToolButton label="Đoạn văn thường" active={state.paragraph} onClick={() => chain().setParagraph().run()}>
						¶
					</ToolButton>
					<ToolButton label="Tiêu đề mục (cấp 2)" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
						H2
					</ToolButton>
					<ToolButton label="Tiêu đề nhỏ (cấp 3)" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
						H3
					</ToolButton>
					<ToolButton label="Tiêu đề nhỏ hơn (cấp 4)" active={state.h4} onClick={() => chain().toggleHeading({ level: 4 }).run()}>
						H4
					</ToolButton>
					<Divider />
					<ToolButton label="In đậm (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
						<strong>B</strong>
					</ToolButton>
					<ToolButton label="In nghiêng (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
						<em>I</em>
					</ToolButton>
					<ToolButton label="Gạch chân (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
						<u>U</u>
					</ToolButton>
					<ToolButton label="Gạch ngang" active={state.strike} onClick={() => chain().toggleStrike().run()}>
						<s>S</s>
					</ToolButton>
					<ToolButton label="Xóa định dạng" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
						⌫
					</ToolButton>
					<Divider />
					<select aria-label="Phông chữ" className="tq-input" style={{ maxWidth: 150, width: "auto", minHeight: 0, padding: "4px 6px" }} value={state.fontFamily} onChange={(event) => (event.target.value ? chain().setFontFamily(event.target.value).run() : chain().unsetFontFamily().run())}>
						{FONT_FAMILIES.map((font) => (
							<option key={font.label} value={font.value}>{font.label}</option>
						))}
					</select>
					<select aria-label="Cỡ chữ" className="tq-input" style={{ maxWidth: 90, width: "auto", minHeight: 0, padding: "4px 6px" }} value={state.fontSize} onChange={(event) => (event.target.value ? chain().setFontSize(`${event.target.value}px`).run() : chain().unsetFontSize().run())}>
						<option value="">Cỡ chữ</option>
						{FONT_SIZES.map((size) => (
							<option key={size} value={size}>{size}</option>
						))}
					</select>
					<label className="tq-btn tq-btn--secondary tq-btn--small" title="Màu chữ" style={{ minWidth: 36, cursor: "pointer" }}>
						<span aria-hidden="true" style={{ borderBottom: `3px solid ${state.color || "currentColor"}` }}>A</span>
						<input type="color" aria-label="Màu chữ" value={/^#[0-9a-f]{6}$/i.test(state.color) ? state.color : "#000000"} onChange={(event) => chain().setColor(event.target.value).run()} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
					</label>
					<ToolButton label="Bỏ màu chữ" onClick={() => chain().unsetColor().run()}>
						A✕
					</ToolButton>
					<label className="tq-btn tq-btn--secondary tq-btn--small" title="Màu nền (tô sáng)" style={{ minWidth: 36, cursor: "pointer", background: state.highlight ? "var(--tq-accent-soft)" : undefined }}>
						<span aria-hidden="true" style={{ background: "#fff176", padding: "0 3px" }}>ab</span>
						<input type="color" aria-label="Màu nền chữ" defaultValue="#fff176" onChange={(event) => chain().setHighlight({ color: event.target.value }).run()} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
					</label>
					<ToolButton label="Bỏ tô sáng" onClick={() => chain().unsetHighlight().run()}>
						ab✕
					</ToolButton>
					<ToolButton label="Chỉ số dưới" active={state.sub} onClick={() => chain().toggleSubscript().run()}>
						x<sub>2</sub>
					</ToolButton>
					<ToolButton label="Chỉ số trên" active={state.sup} onClick={() => chain().toggleSuperscript().run()}>
						x<sup>2</sup>
					</ToolButton>
					<Divider />
					<ToolButton label="Căn trái" active={state.alignLeft} onClick={() => chain().setTextAlign("left").run()}>
						⇤
					</ToolButton>
					<ToolButton label="Căn giữa" active={state.alignCenter} onClick={() => chain().setTextAlign("center").run()}>
						≡
					</ToolButton>
					<ToolButton label="Căn phải" active={state.alignRight} onClick={() => chain().setTextAlign("right").run()}>
						⇥
					</ToolButton>
					<ToolButton label="Căn đều hai bên" active={state.alignJustify} onClick={() => chain().setTextAlign("justify").run()}>
						☰
					</ToolButton>
					<ToolButton label="Thụt lề vào (Ctrl+])" onClick={() => (editor.chain().focus() as unknown as { indentMore: () => { run: () => boolean } }).indentMore().run()}>
						→|
					</ToolButton>
					<ToolButton label="Thụt lề ra (Ctrl+[)" onClick={() => (editor.chain().focus() as unknown as { outdent: () => { run: () => boolean } }).outdent().run()}>
						|←
					</ToolButton>
					<select aria-label="Giãn dòng" className="tq-input" style={{ maxWidth: 90, width: "auto", minHeight: 0, padding: "4px 6px" }} value={state.lineHeight} onChange={(event) => chain().updateAttributes("paragraph", { lineHeight: event.target.value || null }).updateAttributes("heading", { lineHeight: event.target.value || null }).run()}>
						<option value="">Giãn dòng</option>
						{LINE_HEIGHTS.map((height) => (
							<option key={height} value={height}>{height}</option>
						))}
					</select>
					<Divider />
					<ToolButton label="Danh sách dấu chấm" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
						• –
					</ToolButton>
					<ToolButton label="Danh sách đánh số" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
						1.
					</ToolButton>
					<ToolButton label="Danh sách việc có ô tích (checklist)" active={state.task} onClick={() => chain().toggleTaskList().run()}>
						☑
					</ToolButton>
					<ToolButton label="Trích dẫn" active={state.quote} onClick={() => quote(null)}>
						❝
					</ToolButton>
					<ToolButton label="Trích kinh" active={state.kinh} onClick={() => quote("kinh")}>
						Kinh
					</ToolButton>
					<ToolButton label="Thơ, kệ" active={state.tho} onClick={() => quote("tho")}>
						Thơ
					</ToolButton>
					<ToolButton label="Đường kẻ ngang" onClick={() => chain().setHorizontalRule().run()}>
						―
					</ToolButton>
					<Divider />
					<ToolButton label="Chèn hoặc sửa liên kết" active={state.link || panel === "link"} onClick={() => toggle("link")}>
						Liên kết
					</ToolButton>
					<ToolButton label="Chèn ảnh từ thư viện" active={panel === "image"} onClick={() => toggle("image")}>
						Ảnh
					</ToolButton>
					<ToolButton label="Chèn tệp âm thanh" active={panel === "audio"} onClick={() => toggle("audio")}>
						Âm thanh
					</ToolButton>
					<ToolButton label="Chèn video YouTube" active={panel === "video"} onClick={() => toggle("video")}>
						Video
					</ToolButton>
					<ToolButton label="Bảng" active={state.table || panel === "table"} onClick={() => toggle("table")}>
						Bảng
					</ToolButton>
				</div>
			)}

			{panel === "link" ? <LinkForm editor={editor} onDone={() => setPanel(null)} /> : null}
			{panel === "image" ? <ImageForm editor={editor} onDone={() => setPanel(null)} /> : null}
			{panel === "audio" ? <AudioForm editor={editor} onDone={() => setPanel(null)} /> : null}
			{panel === "video" ? <VideoForm editor={editor} onDone={() => setPanel(null)} /> : null}
			{panel === "table" ? <TableTools editor={editor} inTable={state.table} onDone={() => setPanel(null)} /> : null}
			<p className="tq-hint" role="status" style={{ margin: 0, padding: "6px 16px", borderTop: "1px solid var(--tq-line)" }}>
				{(() => {
					const stats = readingStats(editor.getText());
					return `${stats.words.toLocaleString("vi-VN")} từ · ${stats.chars.toLocaleString("vi-VN")} ký tự · đọc khoảng ${stats.minutes} phút`;
				})()}
			</p>
			{(() => {
				const heads: { level: number; text: string; pos: number }[] = [];
				editor.state.doc.descendants((node, pos) => {
					if (node.type.name === "heading") heads.push({ level: node.attrs.level as number, text: node.textContent, pos });
				});
				if (heads.length < 2) return null;
				return (
					<details style={{ padding: "6px 16px", borderTop: "1px solid var(--tq-line)" }}>
						<summary>Mục lục bài ({heads.length} tiêu đề)</summary>
						<ol style={{ margin: "6px 0 0", paddingLeft: 18, listStyle: "none" }}>
							{heads.map((head) => (
								<li key={head.pos} style={{ marginLeft: (head.level - 2) * 16 }}>
									<button type="button" className="tq-btn tq-btn--link" onClick={() => editor.chain().focus().setTextSelection(head.pos + 1).scrollIntoView().run()}>
										{head.text || "(tiêu đề trống)"}
									</button>
								</li>
							))}
						</ol>
					</details>
				);
			})()}
			{state.figure && !readOnly ? <FigureForm key={JSON.stringify(editor.getAttributes("figureImage"))} editor={editor} /> : null}

			<EditorContent editor={editor} />
		</div>
	);
}

/** How the document looks while it is written: close to the article, in the admin's colours. */
const CONTENT_CSS = `
.tq-rich-content { font-size: 17px; line-height: 1.7; }
.tq-rich-content > * + * { margin-top: 0.8em; }
.tq-rich-content h2 { font-size: 1.5rem; margin-top: 1.2em; }
.tq-rich-content h3 { font-size: 1.25rem; margin-top: 1em; }
.tq-rich-content h4 { font-size: 1.1rem; margin-top: 1em; }
.tq-rich-content p { margin: 0; }
.tq-rich-content ul, .tq-rich-content ol { padding-left: 1.6em; }
.tq-rich-content blockquote { margin: 0; padding: 8px 16px; border-left: 4px solid var(--tq-line); color: var(--tq-muted); }
.tq-rich-content blockquote.kinh { border-left-color: var(--tq-accent); background: var(--tq-accent-soft); color: var(--tq-ink); font-style: italic; }
.tq-rich-content blockquote.kinh::before { content: "Trích kinh"; display: block; font-size: 12px; font-style: normal; font-weight: 700; color: var(--tq-accent); }
.tq-rich-content blockquote.tho { border-left-color: var(--tq-muted); text-align: center; font-style: italic; color: var(--tq-ink); }
.tq-rich-content blockquote.tho::before { content: "Thơ, kệ"; display: block; font-size: 12px; font-style: normal; font-weight: 700; color: var(--tq-muted); }
.tq-rich-content figure { margin: 1em 0; text-align: center; }
.tq-rich-content figure img { max-width: 100%; height: auto; border-radius: 6px; }
.tq-rich-content figcaption { font-size: 14px; color: var(--tq-muted); margin-top: 4px; }
.tq-rich-content img { max-width: 100%; }
.tq-rich-content audio { width: 100%; }
.tq-rich-content div[data-youtube-video] iframe { max-width: 100%; aspect-ratio: 16 / 9; height: auto; border: 0; }
.tq-rich-content table { border-collapse: collapse; width: 100%; }
.tq-rich-content td, .tq-rich-content th { border: 1px solid var(--tq-line); padding: 6px 8px; vertical-align: top; }
.tq-rich-content th { background: var(--tq-line-soft); }
.tq-rich-content hr { border: 0; border-top: 1px solid var(--tq-line); }
.tq-rich-content .ProseMirror-selectednode { outline: 3px solid var(--tq-accent); }
.tq-rich-content ul[data-type="taskList"] { list-style: none; padding-left: 4px; }
.tq-rich-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
.tq-rich-content ul[data-type="taskList"] li > label { margin-top: 3px; user-select: none; }
.tq-rich-content ul[data-type="taskList"] li > div { flex: 1; }
.tq-rich-content a { text-decoration: underline; }
`;

const formStyle = { padding: 12, borderBottom: "1px solid var(--tq-line)", background: "var(--tq-card)" } as const;

function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
	const [href, setHref] = useState<string>((editor.getAttributes("link").href as string | undefined) ?? "");
	const [error, setError] = useState("");
	const [nofollow, setNofollow] = useState(/nofollow/.test((editor.getAttributes("link").rel as string | undefined) ?? ""));
	function apply() {
		const value = href.trim();
		if (!value) {
			editor.chain().focus().extendMarkRange("link").unsetLink().run();
			onDone();
			return;
		}
		if (!SAFE_LINK.test(value)) {
			setError("Liên kết phải bắt đầu bằng https://, mailto: hoặc / (đường dẫn trong trang).");
			return;
		}
		const chain = editor.chain().focus().extendMarkRange("link");
		if (editor.state.selection.empty && !editor.isActive("link")) chain.insertContent({ type: "text", text: value, marks: [{ type: "link", attrs: { href: value, rel: nofollow ? "nofollow" : null } }] }).run();
		else chain.setLink({ href: value, rel: nofollow ? "nofollow" : null } as never).run();
		onDone();
	}
	return (
		<div style={formStyle} role="group" aria-label="Liên kết">
			<div className="tq-toolbar">
				<div className="tq-field">
					<label className="tq-label" htmlFor="rich-link">
						Địa chỉ liên kết
					</label>
					<label style={{ display: "block", marginBottom: 6 }}>
						<input type="checkbox" checked={nofollow} onChange={(e) => setNofollow(e.target.checked)} /> Không theo dõi (nofollow). Liên kết ngoài luôn mở tab mới.
					</label>
					<input
						id="rich-link"
						className="tq-input"
						value={href}
						onChange={(e) => setHref(e.target.value)}
						placeholder="https://… hoặc /dong-chay-hoang-phap/…"
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								apply();
							}
							if (e.key === "Escape") onDone();
						}}
					/>
				</div>
				<button type="button" className="tq-btn tq-btn--primary" onClick={apply}>
					Áp dụng
				</button>
				{editor.isActive("link") ? (
					<button
						type="button"
						className="tq-btn tq-btn--secondary"
						onClick={() => {
							editor.chain().focus().extendMarkRange("link").unsetLink().run();
							onDone();
						}}
					>
						Bỏ liên kết
					</button>
				) : null}
				<button type="button" className="tq-btn tq-btn--secondary" onClick={onDone}>
					Đóng
				</button>
			</div>
			{error ? <Alert kind="error">{error}</Alert> : <p className="tq-hint">Liên kết ra ngoài trang sẽ tự mở ở thẻ mới.</p>}
		</div>
	);
}

function ImageForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
	const [picked, setPicked] = useState<{ src: string; mediaId: string; alt: string } | null>(null);
	const [alt, setAlt] = useState("");
	const [caption, setCaption] = useState("");
	if (!picked) {
		return (
			<div style={formStyle}>
				<MediaPicker
					onPick={(item) => {
						setPicked({ src: item.url, mediaId: item.id, alt: item.alt });
						setAlt(item.alt);
						setCaption(item.caption);
					}}
					onCancel={onDone}
				/>
			</div>
		);
	}
	return (
		<div style={formStyle} role="group" aria-label="Chèn ảnh">
			<div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
				<img src={picked.src} alt="" style={{ width: 160, maxWidth: "100%", borderRadius: 6 }} />
				<div style={{ flex: "1 1 240px" }}>
					<div className="tq-field">
						<label className="tq-label" htmlFor="rich-image-alt">
							Mô tả ảnh (cho người khiếm thị)
						</label>
						<input id="rich-image-alt" className="tq-input" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} />
					</div>
					<div className="tq-field">
						<label className="tq-label" htmlFor="rich-image-caption">
							Chú thích dưới ảnh
						</label>
						<input id="rich-image-caption" className="tq-input" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} />
					</div>
					<div className="tq-actions">
						<button
							type="button"
							className="tq-btn tq-btn--primary"
							onClick={() => {
								const attrs: FigureAttrs = { src: picked.src, mediaId: picked.mediaId, alt: alt.trim(), caption: caption.trim(), width: null, align: null };
								editor.chain().focus().insertContent({ type: "figureImage", attrs }).run();
								onDone();
							}}
						>
							Chèn ảnh
						</button>
						<button type="button" className="tq-btn tq-btn--secondary" onClick={() => setPicked(null)}>
							Chọn ảnh khác
						</button>
						<button type="button" className="tq-btn tq-btn--secondary" onClick={onDone}>
							Hủy
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function FigureForm({ editor }: { editor: Editor }) {
	const attrs = editor.getAttributes("figureImage") as FigureAttrs;
	const [alt, setAlt] = useState(attrs.alt ?? "");
	const [caption, setCaption] = useState(attrs.caption ?? "");
	const [replacing, setReplacing] = useState(false);
	return (
		<div style={formStyle} role="group" aria-label="Ảnh đang chọn">
			<p className="tq-label" style={{ margin: "0 0 6px" }}>
				Ảnh đang chọn
			</p>
			<div className="tq-toolbar">
				<div className="tq-field">
					<label className="tq-label" htmlFor="rich-figure-alt">
						Mô tả ảnh
					</label>
					<input id="rich-figure-alt" className="tq-input" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} />
				</div>
				<div className="tq-field">
					<label className="tq-label" htmlFor="rich-figure-caption">
						Chú thích
					</label>
					<input id="rich-figure-caption" className="tq-input" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} />
				</div>
				<div className="tq-field">
					<label className="tq-label" htmlFor="rich-figure-width">
						Rộng
					</label>
					<select id="rich-figure-width" className="tq-input" value={attrs.width ?? 100} onChange={(e) => editor.chain().focus().updateAttributes("figureImage", { width: Number(e.target.value) >= 100 ? null : Number(e.target.value) }).run()}>
						{[25, 33, 50, 66, 75, 100].map((w) => (
							<option key={w} value={w}>
								{w}%
							</option>
						))}
					</select>
				</div>
				<div className="tq-field">
					<label className="tq-label" htmlFor="rich-figure-align">
						Căn lề ảnh
					</label>
					<select id="rich-figure-align" className="tq-input" value={attrs.align ?? ""} onChange={(e) => editor.chain().focus().updateAttributes("figureImage", { align: e.target.value || null }).run()}>
						<option value="">Mặc định</option>
						<option value="left">Trái</option>
						<option value="center">Giữa</option>
						<option value="right">Phải</option>
					</select>
				</div>
				<button type="button" className="tq-btn tq-btn--primary" onClick={() => editor.chain().focus().updateAttributes("figureImage", { alt: alt.trim(), caption: caption.trim() }).run()}>
					Cập nhật
				</button>
				<button type="button" className="tq-btn tq-btn--secondary" onClick={() => setReplacing((now) => !now)} aria-expanded={replacing}>
					Đổi ảnh
				</button>
				<button type="button" className="tq-btn tq-btn--danger" onClick={() => editor.chain().focus().deleteSelection().run()}>
					Gỡ ảnh
				</button>
			</div>
			{replacing ? (
				<MediaPicker
					onPick={(item) => {
						editor.chain().focus().updateAttributes("figureImage", { src: item.url, mediaId: item.id, alt: alt || item.alt }).run();
						setReplacing(false);
					}}
					onCancel={() => setReplacing(false)}
				/>
			) : null}
		</div>
	);
}

function AudioForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
	const [src, setSrc] = useState("");
	const [error, setError] = useState("");
	function apply() {
		const value = src.trim();
		if (!SAFE_AUDIO.test(value)) {
			setError("Địa chỉ tệp âm thanh phải bắt đầu bằng https:// hoặc /anh-goc/.");
			return;
		}
		editor.chain().focus().insertContent({ type: "audioBlock", attrs: { src: value, mediaId: null } }).run();
		onDone();
	}
	return (
		<div style={formStyle} role="group" aria-label="Chèn âm thanh">
			<div className="tq-toolbar">
				<div className="tq-field" style={{ flex: "1 1 280px" }}>
					<label className="tq-label" htmlFor="rich-audio">
						Địa chỉ tệp âm thanh (MP3, M4A)
					</label>
					<input id="rich-audio" className="tq-input" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="https://…/bai-giang.mp3" autoFocus />
				</div>
				<button type="button" className="tq-btn tq-btn--primary" onClick={apply}>
					Chèn
				</button>
				<button type="button" className="tq-btn tq-btn--secondary" onClick={onDone}>
					Hủy
				</button>
			</div>
			{error ? <Alert kind="error">{error}</Alert> : <p className="tq-hint">Thư viện media hiện chỉ nhận ảnh; tệp âm thanh dùng địa chỉ https.</p>}
		</div>
	);
}

function VideoForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
	const [url, setUrl] = useState("");
	const [error, setError] = useState("");
	function apply() {
		const ok = editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
		if (!ok) {
			setError("Không nhận ra địa chỉ video YouTube. Hãy dán địa chỉ dạng https://www.youtube.com/watch?v=…");
			return;
		}
		onDone();
	}
	return (
		<div style={formStyle} role="group" aria-label="Chèn video YouTube">
			<div className="tq-toolbar">
				<div className="tq-field" style={{ flex: "1 1 280px" }}>
					<label className="tq-label" htmlFor="rich-video">
						Địa chỉ video YouTube
					</label>
					<input id="rich-video" className="tq-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus />
				</div>
				<button type="button" className="tq-btn tq-btn--primary" onClick={apply}>
					Chèn
				</button>
				<button type="button" className="tq-btn tq-btn--secondary" onClick={onDone}>
					Hủy
				</button>
			</div>
			{error ? <Alert kind="error">{error}</Alert> : <p className="tq-hint">Video được nhúng qua youtube-nocookie.com (không đặt cookie theo dõi).</p>}
		</div>
	);
}

function TableTools({ editor, inTable, onDone }: { editor: Editor; inTable: boolean; onDone: () => void }) {
	const run = (action: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => action(editor.chain().focus()).run();
	return (
		<div style={formStyle} role="group" aria-label="Bảng">
			<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
				{!inTable ? (
					<button type="button" className="tq-btn tq-btn--primary tq-btn--small" onClick={() => run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}>
						Chèn bảng 3 × 3
					</button>
				) : (
					<>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => run((c) => c.addRowAfter())}>
							Thêm hàng
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => run((c) => c.addColumnAfter())}>
							Thêm cột
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => run((c) => c.deleteRow())}>
							Xóa hàng
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => run((c) => c.deleteColumn())}>
							Xóa cột
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" title="Chọn nhiều ô bằng cách kéo chuột, rồi gộp" onClick={() => run((c) => c.mergeCells())}>
							Gộp ô
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => run((c) => c.splitCell())}>
							Tách ô
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => run((c) => c.setTextAlign("left"))}>
							Căn trái ô
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => run((c) => c.setTextAlign("center"))}>
							Căn giữa ô
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => run((c) => c.setTextAlign("right"))}>
							Căn phải ô
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => run((c) => c.toggleHeaderRow())}>
							Bật/tắt hàng tiêu đề
						</button>
						<button type="button" className="tq-btn tq-btn--danger tq-btn--small" onClick={() => run((c) => c.deleteTable())}>
							Xóa bảng
						</button>
					</>
				)}
				<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={onDone}>
					Đóng
				</button>
			</div>
		</div>
	);
}

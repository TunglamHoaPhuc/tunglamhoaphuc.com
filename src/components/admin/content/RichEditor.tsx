"use client";

// The article editor (TipTap 3). The toolbar follows the WAI-ARIA toolbar pattern: one tab stop, arrow keys move
// between buttons, every button has a Vietnamese label and says whether its format is on. Inserting a link, a
// picture, a sound or a video opens a small form under the toolbar (in the page flow, no pop-up).
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import { useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { MediaPicker } from "../media/MediaPicker";
import { Alert } from "../ui";
import { editorExtensions, type FigureAttrs, type QuoteVariant } from "./editorExtensions";

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
		quote: current.isActive("blockquote", { variant: null }),
		kinh: current.isActive("blockquote", { variant: "kinh" }),
		tho: current.isActive("blockquote", { variant: "tho" }),
		link: current.isActive("link"),
		table: current.isActive("table"),
		figure: current.isActive("figureImage"),
		canUndo: current.can().undo(),
		canRedo: current.can().redo(),
	};
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
					<ToolButton label="Danh sách dấu chấm" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
						• –
					</ToolButton>
					<ToolButton label="Danh sách đánh số" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
						1.
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
.tq-rich-content a { text-decoration: underline; }
`;

const formStyle = { padding: 12, borderBottom: "1px solid var(--tq-line)", background: "var(--tq-card)" } as const;

function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
	const [href, setHref] = useState<string>((editor.getAttributes("link").href as string | undefined) ?? "");
	const [error, setError] = useState("");
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
		if (editor.state.selection.empty && !editor.isActive("link")) chain.insertContent({ type: "text", text: value, marks: [{ type: "link", attrs: { href: value } }] }).run();
		else chain.setLink({ href: value }).run();
		onDone();
	}
	return (
		<div style={formStyle} role="group" aria-label="Liên kết">
			<div className="tq-toolbar">
				<div className="tq-field">
					<label className="tq-label" htmlFor="rich-link">
						Địa chỉ liên kết
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
								const attrs: FigureAttrs = { src: picked.src, mediaId: picked.mediaId, alt: alt.trim(), caption: caption.trim() };
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

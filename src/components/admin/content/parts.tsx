"use client";

// Pieces of the article editor's side column: a library picture with its framing, the category fields, the
// related things, the milestones of a Giới thiệu page and the history with its word-by-word comparison.
import { diffWords } from "diff";
import { useState } from "react";
import { api } from "../api";
import { MediaPicker } from "../media/MediaPicker";
import { useDebounced, useLoader } from "../media/imageTools";
import { Alert, Badge, Button, errorText, Loading, TextField, when } from "../ui";
import { youtubeId } from "./editorLogic";
import type { Comparison, KindName, MediaPreview, Milestone, RelatedItem, Revision } from "./types";

// ------------------------------------------------------------------ a picture field

const POSITIONS = [
	{ value: "center 50%", label: "Giữa" },
	{ value: "center 20%", label: "Lệch lên trên" },
	{ value: "center 80%", label: "Lệch xuống dưới" },
	{ value: "center top", label: "Sát mép trên" },
	{ value: "center bottom", label: "Sát mép dưới" },
	{ value: "left center", label: "Lệch trái" },
	{ value: "right center", label: "Lệch phải" },
];

export function MediaField({
	label,
	mediaId,
	preview,
	position,
	onChange,
	onPosition,
	error,
	disabled,
}: {
	label: string;
	mediaId: string | null;
	preview: MediaPreview | undefined;
	position?: string;
	onChange: (id: string | null, preview: MediaPreview | null) => void;
	onPosition?: (position: string) => void;
	error?: string;
	disabled?: boolean;
}) {
	const [picking, setPicking] = useState(false);
	const custom = position !== undefined && !POSITIONS.some((item) => item.value === position);
	return (
		<div className="tq-field" role="group" aria-label={label}>
			<p className="tq-label" style={{ margin: "0 0 6px" }}>
				{label}
			</p>
			{mediaId ? (
				<div style={{ position: "relative", aspectRatio: "16 / 9", background: "var(--tq-line-soft)", borderRadius: 8, overflow: "hidden", marginBottom: 6 }}>
					{preview?.url ? <img src={preview.url} alt={preview.alt || ""} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: position || "center 50%", display: "block" }} /> : <span className="tq-muted" style={{ padding: 8, display: "block" }}>Ảnh {mediaId}</span>}
				</div>
			) : (
				<p className="tq-muted" style={{ margin: "0 0 6px" }}>
					Chưa chọn ảnh.
				</p>
			)}
			{disabled ? null : (
				<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
					<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => setPicking((now) => !now)} aria-expanded={picking}>
						{mediaId ? "Đổi ảnh" : "Chọn ảnh"}
					</button>
					{mediaId ? (
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => onChange(null, null)}>
							Gỡ ảnh
						</button>
					) : null}
				</div>
			)}
			{mediaId && onPosition && !disabled ? (
				<div style={{ marginTop: 8 }}>
					<label className="tq-label" htmlFor={`${label}-position`}>
						Vùng ảnh hiển thị
					</label>
					<select id={`${label}-position`} className="tq-input" value={custom ? "custom" : position} onChange={(e) => onPosition(e.target.value === "custom" ? (position ?? "center 50%") : e.target.value)}>
						{POSITIONS.map((item) => (
							<option key={item.value} value={item.value}>
								{item.label}
							</option>
						))}
						{custom ? <option value="custom">Tùy chỉnh: {position}</option> : null}
					</select>
				</div>
			) : null}
			{error ? <p className="tq-field-error">{error}</p> : null}
			{picking ? (
				<MediaPicker
					onPick={(item) => {
						onChange(item.id, { id: item.id, url: item.url, thumbUrl: item.thumbUrl, alt: item.alt, mime: item.mime });
						setPicking(false);
					}}
					onCancel={() => setPicking(false)}
				/>
			) : null}
		</div>
	);
}

// ------------------------------------------------------------------ fields of a category (posts)

export function ExtraFields({
	categorySlug,
	extra,
	onChange,
	media,
	onMedia,
	errors,
	disabled,
}: {
	categorySlug: string;
	extra: Record<string, unknown>;
	onChange: (extra: Record<string, unknown>) => void;
	media: Record<string, MediaPreview>;
	onMedia: (preview: MediaPreview) => void;
	errors: Record<string, string>;
	disabled?: boolean;
}) {
	const set = (key: string, value: unknown) => onChange({ ...extra, [key]: value === "" ? undefined : value });
	const str = (value: unknown) => (typeof value === "string" ? value : "");
	if (categorySlug === "phap-am") {
		return (
			<fieldset className="tq-panel" disabled={disabled}>
				<legend className="tq-h2">Pháp Âm</legend>
				<TextField label="Địa chỉ tệp âm thanh" value={str(extra.audioUrl)} onChange={(e) => set("audioUrl", e.target.value)} placeholder="https://…/bai-giang.mp3" error={errors["extra.audioUrl"]} />
				<TextField label="Thời lượng" value={str(extra.duration)} onChange={(e) => set("duration", e.target.value)} placeholder="45:30" hint="Dạng mm:ss hoặc h:mm:ss." error={errors["extra.duration"]} />
			</fieldset>
		);
	}
	if (categorySlug === "video") {
		return (
			<fieldset className="tq-panel" disabled={disabled}>
				<legend className="tq-h2">Video Phật Pháp</legend>
				<TextField
					label="Video YouTube (mã hoặc địa chỉ)"
					value={str(extra.youtubeId)}
					onChange={(e) => set("youtubeId", e.target.value)}
					onBlur={(e) => {
						// Any watch, share or embed address becomes the 11-character id the page stores.
						const id = youtubeId(e.target.value);
						if (id && id !== e.target.value.trim()) set("youtubeId", id);
					}}
					placeholder="https://www.youtube.com/watch?v=…"
					error={errors["extra.youtubeId"]}
				/>
			</fieldset>
		);
	}
	if (categorySlug === "an-pham-sach") {
		const book = (extra.book ?? {}) as Record<string, unknown>;
		const setBook = (key: string, value: unknown) => onChange({ ...extra, book: { ...book, [key]: value } });
		const cover = typeof book.coverMediaId === "string" ? book.coverMediaId : null;
		return (
			<fieldset className="tq-panel" disabled={disabled}>
				<legend className="tq-h2">Ấn phẩm &amp; Sách</legend>
				<TextField label="Tên sách" value={str(book.title)} onChange={(e) => setBook("title", e.target.value)} error={errors["extra.book.title"]} />
				<TextField label="Tác giả" value={str(book.author)} onChange={(e) => setBook("author", e.target.value)} error={errors["extra.book.author"]} />
				<TextField label="Liên kết đọc hoặc mua" value={str(book.link)} onChange={(e) => setBook("link", e.target.value || undefined)} placeholder="https://…" error={errors["extra.book.link"]} />
				<MediaField
					label="Ảnh bìa sách"
					mediaId={cover}
					preview={cover ? media[cover] : undefined}
					onChange={(id, preview) => {
						if (preview) onMedia(preview);
						setBook("coverMediaId", id);
					}}
					error={errors["extra.book.coverMediaId"]}
					disabled={disabled}
				/>
			</fieldset>
		);
	}
	return null;
}

// ------------------------------------------------------------------ related things (posts)

export function RelatedPanel({ postId, initial, disabled }: { postId: string; initial: RelatedItem[]; disabled: boolean }) {
	const [items, setItems] = useState(initial);
	const [q, setQ] = useState("");
	const [dirty, setDirty] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	const search = useDebounced(q.trim(), 300);
	const found = useLoader(() => (search ? api<RelatedItem[]>("GET", `posts/related-candidates?q=${encodeURIComponent(search)}&excludeId=${encodeURIComponent(postId)}`) : Promise.resolve([])), `related-${search}`);

	const change = (next: RelatedItem[]) => {
		setItems(next);
		setDirty(true);
		setMessage(null);
	};
	const move = (index: number, by: number) => {
		const next = [...items];
		const [item] = next.splice(index, 1);
		next.splice(index + by, 0, item);
		change(next);
	};
	async function save() {
		setBusy(true);
		try {
			setItems(await api<RelatedItem[]>("PUT", `posts/${encodeURIComponent(postId)}/related`, { items: items.map((item) => ({ type: item.type, id: item.id })) }));
			setDirty(false);
			setMessage({ kind: "success", text: "Đã lưu mục liên quan." });
		} catch (error) {
			setMessage({ kind: "error", text: errorText(error) });
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className="tq-panel" aria-labelledby="lien-quan">
			<h2 id="lien-quan" className="tq-h2">
				Bài và bảo tượng liên quan
			</h2>
			{items.length === 0 ? <p className="tq-muted">Chưa chọn mục nào; trang sẽ tự gợi ý bài cùng chuyên mục.</p> : null}
			<ol style={{ paddingLeft: 20 }}>
				{items.map((item, index) => (
					<li key={`${item.type}:${item.id}`} style={{ marginBottom: 6 }}>
						<Badge>{item.type === "post" ? "Bài" : "Bảo tượng"}</Badge> {item.title}
						{disabled ? null : (
							<span style={{ display: "inline-flex", gap: 4, marginLeft: 6 }}>
								<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Đưa ${item.title} lên`}>
									↑
								</button>
								<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Đưa ${item.title} xuống`}>
									↓
								</button>
								<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => change(items.filter((_, at) => at !== index))} aria-label={`Bỏ ${item.title}`}>
									Bỏ
								</button>
							</span>
						)}
					</li>
				))}
			</ol>
			{disabled ? null : (
				<>
					<TextField label="Tìm bài hoặc bảo tượng để thêm" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
					{search && found.data ? (
						found.data.length ? (
							<ul style={{ listStyle: "none", padding: 0 }}>
								{found.data
									.filter((item) => !items.some((have) => have.type === item.type && have.id === item.id))
									.map((item) => (
										<li key={`${item.type}:${item.id}`} style={{ marginBottom: 4 }}>
											<button type="button" className="tq-btn tq-btn--link" onClick={() => change([...items, item])}>
												+ {item.type === "post" ? "Bài" : "Bảo tượng"}: {item.title}
											</button>
										</li>
									))}
							</ul>
						) : (
							<p className="tq-muted">Không tìm thấy.</p>
						)
					) : null}
					{items.length >= 20 ? <p className="tq-hint">Tối đa 20 mục.</p> : null}
					<Button variant="secondary" busy={busy} disabled={!dirty || items.length > 20} onClick={() => void save()}>
						Lưu mục liên quan
					</Button>
				</>
			)}
			{message ? <Alert kind={message.kind}>{message.text}</Alert> : null}
		</section>
	);
}

// ------------------------------------------------------------------ milestones (pages)

export function MilestonesEditor({ items, onChange, disabled, error }: { items: Milestone[]; onChange: (items: Milestone[]) => void; disabled?: boolean; error?: string }) {
	const set = (index: number, key: keyof Milestone, value: string) => onChange(items.map((item, at) => (at === index ? { ...item, [key]: value } : item)));
	const move = (index: number, by: number) => {
		const next = [...items];
		const [item] = next.splice(index, 1);
		next.splice(index + by, 0, item);
		onChange(next);
	};
	return (
		<fieldset className="tq-panel" disabled={disabled}>
			<legend className="tq-h2">Mốc niên biểu</legend>
			{items.length === 0 ? <p className="tq-muted">Chưa có mốc nào.</p> : null}
			{items.map((item, index) => (
				<div key={index} style={{ borderTop: index ? "1px solid var(--tq-line)" : undefined, paddingTop: index ? 10 : 0, marginBottom: 10 }}>
					<div className="tq-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
						<TextField label={`Mốc ${index + 1}: năm hoặc giai đoạn`} value={item.label} maxLength={100} onChange={(e) => set(index, "label", e.target.value)} />
						<TextField label="Tiêu đề" value={item.title} maxLength={300} onChange={(e) => set(index, "title", e.target.value)} />
					</div>
					<div className="tq-field">
						<label className="tq-label" htmlFor={`moc-${index}`}>
							Mô tả
						</label>
						<textarea id={`moc-${index}`} className="tq-input" rows={2} value={item.description} maxLength={4000} onChange={(e) => set(index, "description", e.target.value)} />
					</div>
					<div style={{ display: "flex", gap: 6 }}>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Đưa mốc ${index + 1} lên`}>
							↑
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Đưa mốc ${index + 1} xuống`}>
							↓
						</button>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => onChange(items.filter((_, at) => at !== index))} aria-label={`Xóa mốc ${index + 1}`}>
							Xóa mốc
						</button>
					</div>
				</div>
			))}
			{error ? <p className="tq-field-error">{error}</p> : null}
			<Button variant="secondary" disabled={items.length >= 100} onClick={() => onChange([...items, { label: "", title: "", description: "" }])}>
				Thêm mốc
			</Button>
		</fieldset>
	);
}

// ------------------------------------------------------------------ history

/** The words of an HTML body, for comparing (the browser reads the HTML; nothing is shown as HTML). */
function textOfHtml(html: string): string {
	if (typeof DOMParser === "undefined") return html;
	const doc = new DOMParser().parseFromString(html.replace(/<\/(p|h[2-4]|li|blockquote|figure|tr)>/g, "$&\n").replace(/<br\s*\/?>/g, "\n"), "text/html");
	return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

const asText = (key: string, value: unknown) => (key === "contentHtml" ? textOfHtml(String(value ?? "")) : typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 1));

function Diff({ before, after }: { before: string; after: string }) {
	const parts = diffWords(before, after);
	return (
		<p style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.7 }}>
			{parts.map((part, index) =>
				part.added ? (
					<ins key={index} style={{ background: "var(--tq-ok-soft)", textDecoration: "none" }}>
						{part.value}
					</ins>
				) : part.removed ? (
					<del key={index} style={{ background: "var(--tq-danger-soft)" }}>
						{part.value}
					</del>
				) : (
					<span key={index}>{part.value}</span>
				),
			)}
		</p>
	);
}

export function RevisionPanel({ kind, id, version, canRestore, guard = (go) => go(), onRestored }: { kind: KindName; id: string; version: number; canRestore: boolean; /** Runs the restore at once, or after the person agrees to drop unsaved changes. */ guard?: (go: () => void) => void; onRestored: () => void }) {
	const list = useLoader(() => api<Revision[]>("GET", `${kind}/${encodeURIComponent(id)}/revisions`), `rev-${id}-${version}`);
	const [pick, setPick] = useState<number[]>([]);
	const [comparison, setComparison] = useState<Comparison | null>(null);
	const [confirm, setConfirm] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

	async function compare(a: number, b: number) {
		setBusy(true);
		setMessage(null);
		try {
			setComparison(await api<Comparison>("GET", `${kind}/${encodeURIComponent(id)}/revisions/${Math.min(a, b)}/diff/${Math.max(a, b)}`));
		} catch (error) {
			setMessage({ kind: "error", text: errorText(error) });
		} finally {
			setBusy(false);
		}
	}

	async function restore(target: number) {
		setBusy(true);
		setMessage(null);
		try {
			await api("POST", `${kind}/${encodeURIComponent(id)}/revisions/${target}/restore`, { version });
			setConfirm(null);
			setComparison(null);
			onRestored();
		} catch (error) {
			setMessage({ kind: "error", text: errorText(error) });
		} finally {
			setBusy(false);
		}
	}

	const toggle = (value: number) => setPick((now) => (now.includes(value) ? now.filter((item) => item !== value) : [...now, value].slice(-2)));

	return (
		<section className="tq-panel" aria-labelledby="lich-su">
			<h2 id="lich-su" className="tq-h2">
				Lịch sử phiên bản
			</h2>
			{list.error ? (
				<>
					<Alert kind="error">{list.error}</Alert>
					<Button variant="secondary" onClick={list.reload}>
						Thử lại
					</Button>
				</>
			) : !list.data ? (
				<Loading />
			) : (
				<>
					<p className="tq-hint">Đánh dấu hai phiên bản rồi bấm So sánh.</p>
					<ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 320, overflow: "auto" }}>
						{list.data.map((item) => (
							<li key={item.version} style={{ padding: "6px 0", borderBottom: "1px solid var(--tq-line-soft)" }}>
								<label className="tq-check" style={{ marginBottom: 2 }}>
									<input type="checkbox" checked={pick.includes(item.version)} onChange={() => toggle(item.version)} />
									<span>
										<strong>Bản {item.version}</strong>
										{item.version === version ? " (hiện tại)" : ""} · {when(item.createdAt)} · {item.createdByName || "—"}
										<br />
										<span className="tq-muted">{item.summary}</span>
									</span>
								</label>
								{canRestore && item.version !== version ? (
									confirm === item.version ? (
										<span role="group" aria-label={`Xác nhận khôi phục bản ${item.version}`} style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
											<span>Khôi phục nội dung bản {item.version} thành phiên bản mới?</span>
											<Button busy={busy} onClick={() => guard(() => void restore(item.version))}>
												Khôi phục
											</Button>
											<Button variant="secondary" onClick={() => setConfirm(null)}>
												Hủy
											</Button>
										</span>
									) : (
										<button type="button" className="tq-btn tq-btn--link" onClick={() => setConfirm(item.version)}>
											Khôi phục bản này
										</button>
									)
								) : null}
							</li>
						))}
					</ul>
					<div className="tq-actions" style={{ marginTop: 8 }}>
						<Button variant="secondary" busy={busy} disabled={pick.length !== 2} onClick={() => void compare(pick[0], pick[1])}>
							So sánh
						</Button>
						{list.data.length > 1 ? (
							<Button variant="secondary" disabled={busy} onClick={() => void compare(list.data![1].version, list.data![0].version)}>
								So với bản trước
							</Button>
						) : null}
					</div>
				</>
			)}
			{message ? <Alert kind={message.kind}>{message.text}</Alert> : null}
			{comparison ? (
				<div style={{ marginTop: 12 }} aria-live="polite">
					<h3 className="tq-h2" style={{ fontSize: "1.05rem" }}>
						Bản {comparison.a.version} → bản {comparison.b.version}
					</h3>
					{comparison.changed.length === 0 ? <p className="tq-muted">Nội dung hai bản giống nhau (chỉ khác trạng thái).</p> : null}
					{comparison.changed
						.filter((key) => key !== "contentJson")
						.map((key) => (
							<div key={key} style={{ marginBottom: 12 }}>
								<p className="tq-label" style={{ margin: "0 0 4px" }}>
									{comparison.labels[key] ?? key}
								</p>
								<div style={{ border: "1px solid var(--tq-line)", borderRadius: 8, padding: 10, maxHeight: 360, overflow: "auto" }}>
									<Diff before={asText(key, comparison.a.snapshot?.[key])} after={asText(key, comparison.b.snapshot?.[key])} />
								</div>
							</div>
						))}
					<p className="tq-hint">
						<del style={{ background: "var(--tq-danger-soft)" }}>Chữ bị bỏ</del> · <ins style={{ background: "var(--tq-ok-soft)", textDecoration: "none" }}>chữ thêm vào</ins>
					</p>
				</div>
			) : null}
		</section>
	);
}

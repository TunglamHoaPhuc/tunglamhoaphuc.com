"use client";

import { useId, useState, type ChangeEvent, type FormEvent } from "react";
import { api, ApiClientError } from "../api";
import { useAdmin } from "../AdminProvider";
import { Alert, errorText, fieldErrors, Loading, when } from "../ui";
import { CropTool } from "./CropTool";
import { flattenFolders, formatBytes, formatNumber, postForm, prepareImage, SHAPES, useLoader, type Folder, type MediaDetailData, type MediaItem } from "./imageTools";

const ENTITY: Record<string, string> = {
	post: "Bài viết",
	teaching_article: "Bài Tông chỉ",
	page: "Trang giới thiệu",
	area: "Khu vực",
	statue: "Bảo tượng",
	art_variation: "Tác phẩm nghệ thuật",
	monk: "Danh Tăng",
	calendar_event: "Sự kiện",
	featured_program: "Chương trình",
	month_theme: "Chủ đề tháng",
	quote_image: "Tranh Lời Thầy dạy",
	album: "Album",
};
const FIELD: Record<string, string> = {
	thumbnail: "ảnh đại diện",
	banner: "ảnh bìa",
	portrait: "chân dung",
	cover: "ảnh bìa khu vực",
	image: "ảnh",
	avatar: "ảnh đại diện",
	poster: "tranh chủ đề",
	item: "trong album",
};

const LEGACY_NOTE = "Ảnh cũ có thể đang nằm trong nội dung bài viết mà hệ thống chưa theo dõi.";

/** The detail panel of one picture: facts, fields, replace, crops, where it is used, delete. */
export function MediaDetail({ id, folders, onClose, onChanged, onDeleted }: { id: string; folders: Folder[]; onClose: () => void; onChanged: () => void; onDeleted: () => void }) {
	const loader = useLoader(() => api<MediaDetailData>("GET", `media/${encodeURIComponent(id)}`), id);
	const detail = loader.data;

	return (
		<section className="tq-panel" aria-label="Chi tiết ảnh">
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
				<h2 className="tq-h2" style={{ margin: 0 }}>Chi tiết ảnh</h2>
				<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={onClose}>
					Đóng
				</button>
			</div>
			{loader.error ? (
				<>
					<Alert kind="error">{loader.error}</Alert>
					<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={loader.reload}>
						Thử lại
					</button>
				</>
			) : null}
			{!detail && !loader.error ? <Loading /> : null}
			{detail && detail.id === id ? <Body key={detail.id} detail={detail} folders={folders} reload={loader.reload} onChanged={onChanged} onDeleted={onDeleted} /> : null}
		</section>
	);
}

type Delete = "idle" | "confirm" | "force";

function Body({ detail, folders, reload, onChanged, onDeleted }: { detail: MediaDetailData; folders: Folder[]; reload: () => void; onChanged: () => void; onDeleted: () => void }) {
	const { can } = useAdmin();
	const fileId = useId();
	const [title, setTitle] = useState(detail.title);
	const [alt, setAlt] = useState(detail.alt);
	const [caption, setCaption] = useState(detail.caption);
	const [folderId, setFolderId] = useState(detail.folderId ?? "");
	const [busy, setBusy] = useState<"" | "save" | "replace" | "crop" | "delete">("");
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const [message, setMessage] = useState("");
	const [cropping, setCropping] = useState<string | null>(null);
	const [bust, setBust] = useState(0);
	const [copied, setCopied] = useState("");
	const [remove, setRemove] = useState<Delete>("idle");
	const [removeError, setRemoveError] = useState("");

	const canUpdate = can("media", "update");
	const canDelete = can("media", "delete");
	const base = `media/${encodeURIComponent(detail.id)}`;
	const folderOptions = flattenFolders(folders);
	const item: MediaItem = detail;

	function start(kind: typeof busy) {
		setBusy(kind);
		setError("");
		setFields({});
		setMessage("");
	}

	async function save(event: FormEvent) {
		event.preventDefault();
		start("save");
		try {
			await api<MediaItem>("PATCH", base, { title, alt, caption, folderId: folderId || null });
			setMessage("Đã lưu.");
			onChanged();
			reload();
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		} finally {
			setBusy("");
		}
	}

	async function replace(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		start("replace");
		try {
			const prepared = await prepareImage(file);
			const form = new FormData();
			form.append("file", prepared.blob, prepared.name);
			await postForm<MediaItem>("PUT", `${base}/file`, form);
			setMessage(`Đã thay ảnh. Mọi nơi đang dùng ảnh này đều hiện ảnh mới.${detail.crops.length ? " Các bản cắt cũ đã bị xóa, hãy cắt lại nếu cần." : ""}`);
			onChanged();
			reload();
		} catch (caught) {
			setError(errorText(caught));
		} finally {
			setBusy("");
		}
	}

	async function removeCrop(ratio: string) {
		start("crop");
		try {
			await api("DELETE", `${base}/crops/${encodeURIComponent(ratio)}`);
			setMessage(`Đã xóa bản cắt ${ratio}.`);
			reload();
		} catch (caught) {
			setError(errorText(caught));
		} finally {
			setBusy("");
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(detail.url);
			setCopied("Đã sao chép");
		} catch {
			setCopied("Không sao chép được. Hãy chọn địa chỉ bên dưới rồi nhấn Ctrl+C.");
		}
	}

	async function destroy(force: boolean) {
		start("delete");
		setRemoveError("");
		try {
			await api("DELETE", `${base}${force ? "?force=1" : ""}`);
			onDeleted();
		} catch (caught) {
			if (caught instanceof ApiClientError && caught.code === "in_use" && !force) setRemove("force");
			setRemoveError(errorText(caught));
		} finally {
			setBusy("");
		}
	}

	return (
		<div style={{ display: "grid", gap: 14, marginTop: 10 }}>
			<img src={detail.url} alt={detail.alt || detail.filename} style={{ maxWidth: "100%", maxHeight: 360, objectFit: "contain", background: "var(--tq-line-soft)", borderRadius: "var(--tq-radius)" }} />

			<dl className="tq-kv">
				<dt>Tên tệp</dt>
				<dd style={{ wordBreak: "break-all" }}>{detail.filename}</dd>
				<dt>Kích thước</dt>
				<dd>{detail.width && detail.height ? `${formatNumber(detail.width)} × ${formatNumber(detail.height)} px` : "—"}</dd>
				<dt>Dung lượng</dt>
				<dd>{formatBytes(detail.sizeBytes)}</dd>
				<dt>Loại</dt>
				<dd>{detail.mime || "—"}</dd>
				<dt>Phiên bản</dt>
				<dd>{detail.version}</dd>
				<dt>Ngày tải</dt>
				<dd>{when(detail.createdAt)}</dd>
				<dt>Nguồn</dt>
				<dd>{detail.source === "cms" ? "Tải lên từ trang quản trị" : "Ảnh cũ (chuyển từ trang quản trị cũ)"}</dd>
			</dl>

			{error ? <Alert kind="error">{error}</Alert> : null}
			{message ? <Alert kind="success">{message}</Alert> : null}

			<div>
				<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => void copy()}>
					Sao chép địa chỉ ảnh
				</button>{" "}
				<span role="status" className="tq-muted">{copied}</span>
				<p className="tq-code" style={{ wordBreak: "break-all", margin: "6px 0 0" }}>{detail.url}</p>
			</div>

			{canUpdate ? (
				<form onSubmit={save} noValidate style={{ display: "grid", gap: 8 }} aria-label="Thông tin ảnh">
					<div className="tq-field">
						<label htmlFor={`${fileId}-title`} className="tq-label">Tiêu đề</label>
						<input id={`${fileId}-title`} className="tq-input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-invalid={fields.title ? true : undefined} />
						{fields.title ? <p className="tq-field-error">{fields.title}</p> : null}
					</div>
					<div className="tq-field">
						<label htmlFor={`${fileId}-alt`} className="tq-label">Văn bản thay thế (alt)</label>
						<input id={`${fileId}-alt`} className="tq-input" value={alt} maxLength={300} onChange={(e) => setAlt(e.target.value)} aria-describedby={`${fileId}-alt-hint`} aria-invalid={fields.alt ? true : undefined} />
						<p id={`${fileId}-alt-hint`} className={fields.alt ? "tq-field-error" : "tq-hint"}>{fields.alt || "Mô tả ảnh cho người dùng đọc màn hình"}</p>
					</div>
					<div className="tq-field">
						<label htmlFor={`${fileId}-caption`} className="tq-label">Chú thích</label>
						<textarea id={`${fileId}-caption`} className="tq-input" rows={2} value={caption} maxLength={500} onChange={(e) => setCaption(e.target.value)} aria-invalid={fields.caption ? true : undefined} />
						{fields.caption ? <p className="tq-field-error">{fields.caption}</p> : null}
					</div>
					<div className="tq-field">
						<label htmlFor={`${fileId}-folder`} className="tq-label">Thư mục</label>
						<select id={`${fileId}-folder`} className="tq-input" value={folderId} onChange={(e) => setFolderId(e.target.value)} aria-invalid={fields.folderId ? true : undefined}>
							<option value="">Chưa phân thư mục</option>
							{folderOptions.map((folder) => (
								<option key={folder.id} value={folder.id}>
									{folder.label}
								</option>
							))}
						</select>
						{fields.folderId ? <p className="tq-field-error">{fields.folderId}</p> : null}
					</div>
					<div className="tq-actions">
						<button type="submit" className="tq-btn" disabled={busy !== ""} aria-busy={busy === "save" || undefined}>
							{busy === "save" ? "Đang lưu…" : "Lưu"}
						</button>
					</div>
				</form>
			) : (
				<dl className="tq-kv">
					<dt>Tiêu đề</dt>
					<dd>{detail.title || "—"}</dd>
					<dt>Văn bản thay thế</dt>
					<dd>{detail.alt || "—"}</dd>
					<dt>Chú thích</dt>
					<dd>{detail.caption || "—"}</dd>
				</dl>
			)}

			{canUpdate ? (
				<div className="tq-field">
					<label htmlFor={`${fileId}-replace`} className="tq-label">Thay ảnh</label>
					<input id={`${fileId}-replace`} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => void replace(e)} disabled={busy !== ""} aria-describedby={`${fileId}-replace-hint`} />
					<p id={`${fileId}-replace-hint`} className="tq-hint">
						Giữ nguyên ảnh này ở mọi nơi đang dùng, chỉ đổi hình. Các bản cắt theo khung sẽ bị xóa.{detail.source === "imported" ? " Ảnh cũ ở nguồn khác có thể không thay được; khi đó hãy tải ảnh mới lên." : ""}
					</p>
					{busy === "replace" ? <Loading label="Đang thay ảnh…" /> : null}
				</div>
			) : null}

			<div>
				<h3 className="tq-h2">Cắt ảnh theo khung</h3>
				<ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
					{SHAPES.map((shape) => {
						const crop = detail.crops.find((c) => c.ratio === shape.ratio);
						return (
							<li key={shape.ratio} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
								{crop ? (
									<img src={`${crop.url}${bust ? `?r=${bust}` : ""}`} alt={`Bản cắt ${shape.label} của ${detail.alt || detail.filename}`} style={{ height: 56, maxWidth: 100, objectFit: "contain", background: "var(--tq-line-soft)" }} loading="lazy" />
								) : (
									<span style={{ width: 56, height: 56, display: "inline-block", border: "1px dashed var(--tq-line)" }} aria-hidden="true" />
								)}
								<span style={{ flex: "1 1 140px" }}>
									<strong>{shape.label}</strong> <span className="tq-muted">{shape.hint}</span>
									<br />
									<span className="tq-muted">{crop ? "Đã cắt" : "Chưa cắt"}</span>
								</span>
								{canUpdate ? (
									<span className="tq-actions">
										<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" disabled={busy !== ""} onClick={() => setCropping(shape.ratio)}>
											{crop ? "Cắt lại" : "Cắt"}
										</button>
										{crop ? (
											<button type="button" className="tq-btn tq-btn--danger tq-btn--small" disabled={busy !== ""} onClick={() => void removeCrop(shape.ratio)}>
												Xóa bản cắt
											</button>
										) : null}
									</span>
								) : null}
							</li>
						);
					})}
				</ul>
				{cropping ? (
					<CropTool
						key={cropping}
						item={item}
						ratio={cropping}
						onCancel={() => setCropping(null)}
						onSaved={() => {
							setCropping(null);
							setBust((n) => n + 1);
							setMessage(`Đã lưu bản cắt ${cropping}.`);
							reload();
						}}
					/>
				) : null}
			</div>

			<div>
				<h3 className="tq-h2">Đang dùng ở</h3>
				{detail.usage.length ? (
					<ul style={{ margin: 0, paddingLeft: 18 }}>
						{detail.usage.map((use) => (
							<li key={`${use.entityType}:${use.entityId}:${use.field}`}>
								{ENTITY[use.entityType] ?? use.entityType} <span className="tq-code">{use.entityId}</span>: {FIELD[use.field] ?? use.field}
							</li>
						))}
					</ul>
				) : (
					<p className="tq-muted" style={{ margin: 0 }}>Chưa thấy chỗ nào dùng ảnh này. {LEGACY_NOTE}</p>
				)}
			</div>

			{canDelete ? (
				<div>
					<h3 className="tq-h2">Xóa ảnh</h3>
					{removeError ? <Alert kind="error">{removeError}</Alert> : null}
					{remove === "idle" ? (
						<button type="button" className="tq-btn tq-btn--danger tq-btn--small" onClick={() => setRemove("confirm")}>
							Xóa ảnh
						</button>
					) : remove === "confirm" ? (
						<div role="group" aria-label="Xác nhận xóa ảnh">
							<p style={{ margin: "0 0 6px" }}>Xóa ảnh này khỏi thư viện? {LEGACY_NOTE}</p>
							<div className="tq-actions">
								<button type="button" className="tq-btn tq-btn--danger tq-btn--small" disabled={busy !== ""} onClick={() => void destroy(false)}>
									{busy === "delete" ? "Đang xóa…" : "Xóa"}
								</button>
								<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" disabled={busy !== ""} onClick={() => setRemove("idle")}>
									Hủy
								</button>
							</div>
						</div>
					) : (
						<div role="group" aria-label="Xác nhận xóa ảnh đang dùng">
							<p style={{ margin: "0 0 6px" }}>Ảnh đang được dùng. Nếu vẫn xóa, những chỗ đó sẽ mất ảnh. Chỉ người có quyền xóa mọi ảnh mới làm được.</p>
							<div className="tq-actions">
								<button type="button" className="tq-btn tq-btn--danger tq-btn--small" disabled={busy !== ""} onClick={() => void destroy(true)}>
									{busy === "delete" ? "Đang xóa…" : "Vẫn xóa"}
								</button>
								<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" disabled={busy !== ""} onClick={() => { setRemove("idle"); setRemoveError(""); }}>
									Hủy
								</button>
							</div>
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}

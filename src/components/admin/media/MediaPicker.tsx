"use client";

import { useState } from "react";
import { api, apiList } from "../api";
import { Alert, Badge, EmptyState, errorText, Loading, Pager } from "../ui";
import { flattenFolders, useDebounced, useLoader, usePage, type FolderList, type MediaItem } from "./imageTools";
import { UploadZone } from "./UploadZone";

/** The thumbnails of a list of pictures: each one is a button; `selectedId` marks the one that is open. */
export function MediaGrid({ items, selectedId, onOpen, busy }: { items: MediaItem[]; selectedId?: string | null; onOpen: (item: MediaItem) => void; busy?: boolean }) {
	return (
		<ul aria-busy={busy || undefined} style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, opacity: busy ? 0.6 : 1 }}>
			{items.map((item) => {
				const active = selectedId === item.id;
				return (
					<li key={item.id}>
						<button
							type="button"
							onClick={() => onOpen(item)}
							aria-label={`${item.title || item.filename}${item.usageCount ? `, đang dùng ${item.usageCount} chỗ` : ""}`}
							aria-pressed={selectedId === undefined ? undefined : active}
							style={{
								display: "block",
								width: "100%",
								padding: 6,
								textAlign: "left",
								font: "inherit",
								color: "inherit",
								cursor: "pointer",
								background: active ? "var(--tq-accent-soft)" : "var(--tq-card)",
								border: `2px solid ${active ? "var(--tq-accent)" : "var(--tq-line)"}`,
								borderRadius: "var(--tq-radius)",
							}}
						>
							<span style={{ display: "block", aspectRatio: "1 / 1", background: "var(--tq-line-soft)", borderRadius: 6, overflow: "hidden" }}>
								<img src={item.thumbUrl || item.url} alt={item.alt || item.filename} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
							</span>
							<span style={{ display: "block", marginTop: 6, fontSize: 13, wordBreak: "break-all", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.filename}>
								{item.filename}
							</span>
							<span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
								{item.source === "imported" ? <Badge>Ảnh cũ</Badge> : null}
								{item.usageCount > 0 ? <Badge tone="ok">Đang dùng ×{item.usageCount}</Badge> : null}
							</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

/**
 * Picks a picture from the library: search, a folder filter and an upload zone. It is a block in the page flow
 * (not a pop-up); `onPick` gets the chosen picture, `onCancel` (when given) shows a "Hủy" button.
 */
export function MediaPicker({ onPick, folderId, onCancel }: { onPick: (item: MediaItem) => void; folderId?: string; onCancel?: () => void }) {
	const [q, setQ] = useState("");
	const [folder, setFolder] = useState(folderId ?? "");
	const [message, setMessage] = useState("");
	const search = useDebounced(q.trim(), 300);

	const params = new URLSearchParams();
	if (search) params.set("q", search);
	if (folder) params.set("folderId", folder);
	const filterKey = params.toString();
	const [page, setPage] = usePage(filterKey);
	params.set("page", String(page));
	params.set("pageSize", "24");
	const query = params.toString();

	const folders = useLoader(() => api<FolderList>("GET", "media/folders"), "folders");
	const list = useLoader(() => apiList<MediaItem>(`media?${query}`), query);
	const result = list.data;
	const options = flattenFolders(folders.data?.folders ?? []);

	async function pickExisting(id: string) {
		setMessage("");
		try {
			onPick(await api<MediaItem>("GET", `media/${encodeURIComponent(id)}`));
		} catch (caught) {
			setMessage(errorText(caught));
		}
	}

	return (
		<section className="tq-panel" aria-label="Chọn ảnh từ thư viện">
			<div className="tq-toolbar" role="search">
				<div className="tq-field">
					<label htmlFor="picker-q" className="tq-label">Tìm ảnh</label>
					<input id="picker-q" type="search" className="tq-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên tệp, tiêu đề hoặc mô tả" />
				</div>
				<div className="tq-field">
					<label htmlFor="picker-folder" className="tq-label">Thư mục</label>
					<select id="picker-folder" className="tq-input" value={folder} onChange={(e) => setFolder(e.target.value)}>
						<option value="">Tất cả</option>
						<option value="none">Chưa phân thư mục</option>
						{options.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				{onCancel ? (
					<button type="button" className="tq-btn tq-btn--secondary" onClick={onCancel}>
						Hủy
					</button>
				) : null}
			</div>

			<UploadZone folderId={folder && folder !== "none" ? folder : null} onDone={list.reload} onUseExisting={(id) => void pickExisting(id)} />

			{message ? <Alert kind="error">{message}</Alert> : null}
			{list.error ? (
				<>
					<Alert kind="error">{list.error}</Alert>
					<button type="button" className="tq-btn tq-btn--secondary" onClick={list.reload}>
						Thử lại
					</button>
				</>
			) : !result ? (
				<Loading />
			) : result.rows.length === 0 ? (
				<EmptyState>{search || folder ? "Không có ảnh nào khớp." : "Thư viện chưa có ảnh nào."}</EmptyState>
			) : (
				<>
					<p className="tq-hint">Chọn một ảnh để dùng.</p>
					<MediaGrid items={result.rows} onOpen={onPick} busy={list.loading} />
					<Pager page={result.page} pageSize={result.pageSize} total={result.total} onPage={setPage} />
				</>
			)}
		</section>
	);
}

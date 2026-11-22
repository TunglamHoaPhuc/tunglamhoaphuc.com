"use client";

import { useState } from "react";
import { api, apiList } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { FolderTree } from "@/components/admin/media/FolderTree";
import { formatBytes, formatNumber, useDebounced, useLoader, usePage, type FolderList, type MediaItem, type MediaStats } from "@/components/admin/media/imageTools";
import { MediaDetail } from "@/components/admin/media/MediaDetail";
import { MediaGrid } from "@/components/admin/media/MediaPicker";
import { UploadZone } from "@/components/admin/media/UploadZone";
import { Alert, EmptyState, Loading, PageHeader, Pager } from "@/components/admin/ui";

export default function MediaPage() {
	const { can } = useAdmin();
	if (!can("media", "view")) {
		return (
			<>
				<PageHeader title="Thư viện Media" />
				<Alert kind="warning">Bạn không có quyền xem thư viện media.</Alert>
			</>
		);
	}
	return <Library />;
}

function Library() {
	const { can, scope } = useAdmin();
	const [q, setQ] = useState("");
	const [sort, setSort] = useState("newest");
	const [unused, setUnused] = useState(false);
	const [folder, setFolder] = useState("");
	const [openId, setOpenId] = useState<string | null>(null);
	const [showUpload, setShowUpload] = useState(true);
	const search = useDebounced(q.trim(), 300);

	const params = new URLSearchParams();
	if (search) params.set("q", search);
	if (folder) params.set("folderId", folder);
	if (unused) params.set("unused", "1");
	params.set("sort", sort);
	const filterKey = params.toString();
	const [page, setPage] = usePage(filterKey);
	params.set("page", String(page));
	const query = params.toString();

	const list = useLoader(() => apiList<MediaItem>(`media?${query}`), query);
	const stats = useLoader(() => api<MediaStats>("GET", "media/stats"), "stats");
	const folders = useLoader(() => api<FolderList>("GET", "media/folders"), "folders");
	const result = list.data;
	const numbers = stats.data;

	const refreshAll = () => {
		list.reload();
		stats.reload();
		folders.reload();
	};

	return (
		<>
			<PageHeader title="Thư viện Media">
				{can("media", "create") ? (
					<button type="button" className="tq-btn tq-btn--secondary" aria-expanded={showUpload} onClick={() => setShowUpload((v) => !v)}>
						{showUpload ? "Ẩn khung tải ảnh" : "Tải ảnh lên"}
					</button>
				) : null}
			</PageHeader>

			{numbers ? (
				<p className="tq-muted" role="status">
					{formatNumber(numbers.total.count)} ảnh, {formatBytes(numbers.total.bytes)}. Chưa dùng: {formatNumber(numbers.unused.count)} ảnh, {formatBytes(numbers.unused.bytes)}.
					{numbers.total.withoutSize > 0 ? ` Dung lượng của ${formatNumber(numbers.total.withoutSize)} ảnh cũ chưa rõ nên chưa được cộng vào.` : ""}
				</p>
			) : stats.error ? (
				<p className="tq-muted">Không tải được số liệu: {stats.error}</p>
			) : null}

			<div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
				<aside style={{ flex: "1 1 220px", maxWidth: 300, minWidth: 0 }}>
					{folders.error ? <Alert kind="error">{folders.error}</Alert> : null}
					<FolderTree
						list={folders.data}
						total={numbers?.total.count ?? null}
						selected={folder}
						onSelect={setFolder}
						onChanged={() => {
							folders.reload();
							list.reload();
						}}
						canCreate={can("media", "create")}
						canUpdate={scope("media", "update") === "all"}
						canDelete={scope("media", "delete") === "all"}
					/>
				</aside>

				<div style={{ flex: "4 1 480px", minWidth: 0 }}>
					<div className="tq-toolbar" role="search">
						<div className="tq-field">
							<label htmlFor="media-q" className="tq-label">Tìm kiếm</label>
							<input id="media-q" type="search" className="tq-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên tệp, tiêu đề hoặc mô tả" />
						</div>
						<div className="tq-field">
							<label htmlFor="media-sort" className="tq-label">Sắp xếp</label>
							<select id="media-sort" className="tq-input" value={sort} onChange={(e) => setSort(e.target.value)}>
								<option value="newest">Mới nhất</option>
								<option value="name">Theo tên</option>
								<option value="size">Dung lượng lớn nhất</option>
							</select>
						</div>
						<label className="tq-check">
							<input type="checkbox" checked={unused} onChange={(e) => setUnused(e.target.checked)} /> Chỉ hiện ảnh chưa dùng
						</label>
					</div>
					{unused ? <p className="tq-hint">Ảnh cũ có thể đang nằm trong nội dung bài viết mà hệ thống chưa theo dõi, nên "chưa dùng" chưa chắc là không dùng.</p> : null}

					{showUpload && can("media", "create") ? (
						<div style={{ marginBottom: 14 }}>
							<UploadZone folderId={folder && folder !== "none" ? folder : null} onDone={refreshAll} onUseExisting={setOpenId} />
						</div>
					) : null}

					<div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
						<div style={{ flex: "2 1 360px", minWidth: 0 }}>
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
								<EmptyState>{search || folder || unused ? "Không có ảnh nào khớp bộ lọc." : "Thư viện chưa có ảnh nào. Hãy tải ảnh lên."}</EmptyState>
							) : (
								<>
									<MediaGrid items={result.rows} selectedId={openId} onOpen={(item) => setOpenId(item.id)} busy={list.loading} />
									<Pager page={result.page} pageSize={result.pageSize} total={result.total} onPage={setPage} />
								</>
							)}
						</div>

						{openId ? (
							<div style={{ flex: "1 1 340px", minWidth: 0 }}>
								<MediaDetail
									key={openId}
									id={openId}
									folders={folders.data?.folders ?? []}
									onClose={() => setOpenId(null)}
									onChanged={refreshAll}
									onDeleted={() => {
										setOpenId(null);
										refreshAll();
									}}
								/>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</>
	);
}

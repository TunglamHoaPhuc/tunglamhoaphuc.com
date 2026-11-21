"use client";

import { useState } from "react";
import { api, apiList } from "../api";
import { useAdmin } from "../AdminProvider";
import { useLoader, usePage } from "../media/imageTools";
import { Alert, Button, EmptyState, Loading, PageHeader, Pager, TextField, when } from "../ui";
import { LoadError, NoRight } from "./common";
import { JsonDiff } from "./JsonDiff";

type Row = { id: number; userId: string | null; userEmail: string; userName: string; action: string; entityType: string; entityId: string; ip: string; createdAt: string };
type Detail = Row & { userAgent: string; requestId: string; before: unknown; after: unknown };

const EMPTY = { q: "", action: "", entityType: "", entityId: "", userId: "", ip: "", from: "", to: "" };
type Filters = typeof EMPTY;

function EntryDetail({ id }: { id: number }) {
	const load = useLoader(() => api<Detail>("GET", `audit/${id}`), `audit-${id}`);
	if (load.error) return <LoadError error={load.error} onRetry={load.reload} />;
	if (!load.data) return <Loading />;
	const d = load.data;
	return (
		<div>
			<dl className="tq-kv">
				<dt>Thời gian</dt>
				<dd>{when(d.createdAt)}</dd>
				<dt>Người thực hiện</dt>
				<dd>{d.userName ? `${d.userName} · ` : ""}{d.userEmail || "—"}{d.userId ? <span className="tq-muted"> ({d.userId})</span> : null}</dd>
				<dt>Thao tác</dt>
				<dd>{d.action}</dd>
				<dt>Đối tượng</dt>
				<dd>{d.entityType} · {d.entityId}</dd>
				<dt>Địa chỉ IP</dt>
				<dd>{d.ip || "—"}</dd>
				<dt>Trình duyệt</dt>
				<dd style={{ wordBreak: "break-word" }}>{d.userAgent || "—"}</dd>
				{d.requestId ? (
					<>
						<dt>Mã yêu cầu</dt>
						<dd>{d.requestId}</dd>
					</>
				) : null}
			</dl>
			<h3 className="tq-h2" style={{ fontSize: "1rem" }}>Thay đổi (trước → sau)</h3>
			<JsonDiff before={d.before} after={d.after} />
		</div>
	);
}

export function AuditLog() {
	const { can } = useAdmin();
	const [draft, setDraft] = useState<Filters>(EMPTY);
	const [applied, setApplied] = useState<Filters>(EMPTY);
	const [openId, setOpenId] = useState<number | null>(null);

	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(applied)) if (value.trim()) params.set(key, value.trim());
	const filterKey = params.toString();
	const [page, setPage] = usePage(filterKey);
	params.set("page", String(page));
	const query = params.toString();
	const list = useLoader(() => apiList<Row>(`audit?${query}`), query);
	const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((old) => ({ ...old, [key]: e.target.value }));

	if (!can("audit", "view")) return <NoRight />;
	const result = list.data;
	return (
		<>
			<PageHeader title="Nhật ký hoạt động" />
			<p className="tq-muted">Mọi thay đổi trong trang quản trị được ghi lại ở đây. Nhật ký chỉ để xem: không sửa hay xóa được.</p>

			<form
				className="tq-panel"
				role="search"
				aria-label="Lọc nhật ký"
				onSubmit={(e) => {
					e.preventDefault();
					setApplied(draft);
					setOpenId(null);
				}}
			>
				<div className="tq-toolbar">
					<TextField label="Tìm kiếm" type="search" value={draft.q} onChange={set("q")} placeholder="Email, thao tác hoặc đối tượng" />
					<TextField label="Thao tác" value={draft.action} onChange={set("action")} placeholder="vd. post.update" />
					<TextField label="Loại đối tượng" value={draft.entityType} onChange={set("entityType")} placeholder="vd. post" />
					<TextField label="Mã đối tượng" value={draft.entityId} onChange={set("entityId")} />
					<TextField label="Mã tài khoản" value={draft.userId} onChange={set("userId")} />
					<TextField label="Địa chỉ IP" value={draft.ip} onChange={set("ip")} />
					<TextField label="Từ ngày" type="date" value={draft.from} onChange={set("from")} />
					<TextField label="Đến ngày" type="date" value={draft.to} onChange={set("to")} />
				</div>
				<div className="tq-actions">
					<button type="submit" className="tq-btn tq-btn--primary">Lọc</button>
					<Button
						variant="secondary"
						onClick={() => {
							setDraft(EMPTY);
							setApplied(EMPTY);
							setOpenId(null);
						}}
					>
						Xóa bộ lọc
					</Button>
				</div>
			</form>

			{list.error ? (
				<LoadError error={list.error} onRetry={list.reload} />
			) : !result ? (
				<Loading />
			) : result.rows.length === 0 ? (
				<EmptyState>{filterKey ? "Không có dòng nhật ký nào khớp bộ lọc." : "Nhật ký chưa có dòng nào."}</EmptyState>
			) : (
				<>
					<div className="tq-table-wrap" aria-busy={list.loading || undefined}>
						<table className="tq-table">
							<caption className="tq-h2">Nhật ký ({result.total})</caption>
							<thead>
								<tr>
									<th scope="col">Thời gian</th>
									<th scope="col">Người thực hiện</th>
									<th scope="col">Thao tác</th>
									<th scope="col">Đối tượng</th>
									<th scope="col">IP</th>
									<th scope="col"><span className="tq-muted">Chi tiết</span></th>
								</tr>
							</thead>
							<tbody>
								{result.rows.flatMap((row) => {
									const open = openId === row.id;
									const lines = [
										<tr key={row.id}>
											<td>{when(row.createdAt)}</td>
											<td>
												{row.userName ? <strong>{row.userName}</strong> : null}
												{row.userName ? <br /> : null}
												<span className="tq-muted">{row.userEmail || "—"}</span>
											</td>
											<td>{row.action}</td>
											<td>{row.entityType} · <span style={{ wordBreak: "break-all" }}>{row.entityId}</span></td>
											<td>{row.ip || "—"}</td>
											<td>
												<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" aria-expanded={open} aria-controls={`audit-detail-${row.id}`} onClick={() => setOpenId(open ? null : row.id)}>
													{open ? "Đóng" : "Xem"}
												</button>
											</td>
										</tr>,
									];
									if (open) {
										lines.push(
											<tr key={`${row.id}-detail`}>
												<td colSpan={6} id={`audit-detail-${row.id}`}>
													<EntryDetail id={row.id} />
												</td>
											</tr>,
										);
									}
									return lines;
								})}
							</tbody>
						</table>
					</div>
					<Pager page={result.page} pageSize={result.pageSize} total={result.total} onPage={setPage} />
				</>
			)}
			{list.error ? null : <Alert kind="info">Ngày lọc tính theo giờ Việt Nam.</Alert>}
		</>
	);
}

"use client";

import { useState } from "react";
import { api, apiList } from "../api";
import { useAdmin } from "../AdminProvider";
import { useLoader, usePage } from "../media/imageTools";
import { Alert, Button, EmptyState, errorText, Loading, PageHeader, Pager, SelectField, when } from "../ui";
import { LoadError, NoRight } from "./common";

type Row = { type: string; typeLabel: string; id: string; title: string; deletedAt: string; deletedBy: string | null; deletedByName: string };

export function TrashList() {
	const { can } = useAdmin();
	const [type, setType] = useState("");
	const [confirming, setConfirming] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

	const [page, setPage] = usePage(type);
	const query = `${type ? `type=${encodeURIComponent(type)}&` : ""}page=${page}`;
	const types = useLoader(() => api<{ types: { type: string; label: string }[] }>("GET", "trash/types"), "types");
	const list = useLoader(() => apiList<Row>(`trash?${query}`), query);

	if (!can("trash", "view")) return <NoRight />;

	const keyOf = (row: Row) => `${row.type}/${row.id}`;
	async function restore(row: Row) {
		setBusy(keyOf(row));
		setMessage(null);
		try {
			await api("POST", `trash/${encodeURIComponent(row.type)}/${encodeURIComponent(row.id)}/restore`, {});
			setMessage({ kind: "success", text: `Đã khôi phục “${row.title || row.id}”.` });
			list.reload();
		} catch (caught) {
			setMessage({ kind: "error", text: errorText(caught) });
		} finally {
			setBusy(null);
		}
	}
	async function purge(row: Row) {
		setBusy(keyOf(row));
		setMessage(null);
		try {
			await api("DELETE", `trash/${encodeURIComponent(row.type)}/${encodeURIComponent(row.id)}`);
			setConfirming(null);
			setMessage({ kind: "success", text: `Đã xóa vĩnh viễn “${row.title || row.id}”.` });
			list.reload();
		} catch (caught) {
			setConfirming(null);
			setMessage({ kind: "error", text: errorText(caught) });
		} finally {
			setBusy(null);
		}
	}

	const result = list.data;
	return (
		<>
			<PageHeader title="Thùng rác" />
			<p className="tq-muted">Nội dung đã xóa nằm ở đây, không còn hiện trên trang web. Khôi phục để đưa lại; xóa vĩnh viễn thì không lấy lại được.</p>

			<div className="tq-toolbar">
				<SelectField label="Loại nội dung" value={type} onChange={(e) => { setType(e.target.value); setConfirming(null); }}>
					<option value="">Tất cả</option>
					{types.data?.types.map((item) => (
						<option key={item.type} value={item.type}>{item.label}</option>
					))}
				</SelectField>
			</div>

			{message ? <Alert kind={message.kind}>{message.text}</Alert> : null}

			{list.error ? (
				<LoadError error={list.error} onRetry={list.reload} />
			) : !result ? (
				<Loading />
			) : result.rows.length === 0 ? (
				<EmptyState>{type ? "Thùng rác không có mục nào thuộc loại này." : "Thùng rác trống."}</EmptyState>
			) : (
				<>
					<div className="tq-table-wrap" aria-busy={list.loading || undefined}>
						<table className="tq-table">
							<caption className="tq-h2">Đã xóa ({result.total})</caption>
							<thead>
								<tr>
									<th scope="col">Tên</th>
									<th scope="col">Loại</th>
									<th scope="col">Xóa lúc</th>
									<th scope="col">Người xóa</th>
									<th scope="col">Thao tác</th>
								</tr>
							</thead>
							<tbody>
								{result.rows.map((row) => {
									const key = keyOf(row);
									const sure = confirming === key;
									return (
										<tr key={key}>
											<td><strong>{row.title || "(Không có tên)"}</strong></td>
											<td>{row.typeLabel}</td>
											<td>{when(row.deletedAt)}</td>
											<td>{row.deletedByName || "—"}</td>
											<td>
												{sure ? (
													<div role="group" aria-label={`Xác nhận xóa vĩnh viễn ${row.title}`}>
														<p style={{ margin: "0 0 6px" }}>Xóa vĩnh viễn “{row.title || row.id}”? Không thể lấy lại.</p>
														<div className="tq-actions">
															<Button variant="danger" busy={busy === key} onClick={() => void purge(row)}>Xóa vĩnh viễn</Button>
															<Button variant="secondary" disabled={busy === key} onClick={() => setConfirming(null)}>Không xóa</Button>
														</div>
													</div>
												) : (
													<div className="tq-actions">
														{can("trash", "update") ? (
															<Button variant="secondary" className="tq-btn tq-btn--secondary tq-btn--small" busy={busy === key} onClick={() => void restore(row)} aria-label={`Khôi phục ${row.title}`}>Khôi phục</Button>
														) : null}
														{can("trash", "delete") ? (
															<Button variant="danger" className="tq-btn tq-btn--danger tq-btn--small" disabled={busy === key} onClick={() => setConfirming(key)} aria-label={`Xóa vĩnh viễn ${row.title}`}>Xóa vĩnh viễn</Button>
														) : null}
													</div>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					<Pager page={result.page} pageSize={result.pageSize} total={result.total} onPage={setPage} />
				</>
			)}
		</>
	);
}

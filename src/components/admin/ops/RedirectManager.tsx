"use client";

import { useState } from "react";
import { api, apiList } from "../api";
import { useAdmin } from "../AdminProvider";
import { useDebounced, useLoader, usePage } from "../media/imageTools";
import { Alert, Badge, Button, EmptyState, errorText, fieldErrors, Loading, PageHeader, Pager, SelectField, TextField } from "../ui";
import { LoadError, NoRight } from "./common";
import { parseRedirectList } from "./redirectCsv";

type Row = { from: string; to: string; code: 301 | 302; note: string; hits: number; active: boolean };
type Report = { created: number; skipped: number; errors: number; report: { line: number; from: string; status: "created" | "skipped" | "error"; message: string }[] };

/** A row's id in the address: the path percent-encoded twice, because the path itself holds slashes. */
const idOf = (from: string) => encodeURIComponent(encodeURIComponent(from));
const MAX_ROWS = 500;

function AddForm({ onDone }: { onDone: () => void }) {
	const [form, setForm] = useState({ from: "", to: "", code: "301", note: "" });
	const [busy, setBusy] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setErrors({});
		setMessage(null);
		try {
			await api("POST", "redirects", { from: form.from, to: form.to, code: Number(form.code), note: form.note });
			setForm({ from: "", to: "", code: form.code, note: "" });
			setMessage({ kind: "success", text: "Đã thêm chuyển hướng." });
			onDone();
		} catch (caught) {
			setErrors(fieldErrors(caught));
			setMessage({ kind: "error", text: errorText(caught) });
		} finally {
			setBusy(false);
		}
	}
	return (
		<form className="tq-panel" onSubmit={(e) => void submit(e)} noValidate aria-label="Thêm chuyển hướng">
			<h2 className="tq-h2">Thêm chuyển hướng</h2>
			<div className="tq-toolbar">
				<TextField label="Đường dẫn cũ" value={form.from} error={errors.from} placeholder="/bai-viet-cu" hint="Bắt đầu bằng /, không có dấu ? hay #." onChange={(e) => setForm({ ...form, from: e.target.value })} />
				<TextField label="Chuyển tới" value={form.to} error={errors.to} placeholder="/bai-viet-moi" hint="Đường dẫn trong trang, hoặc https://www.tunglamhoaphuc.com/…" onChange={(e) => setForm({ ...form, to: e.target.value })} />
				<SelectField label="Loại" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}>
					<option value="301">301 – vĩnh viễn</option>
					<option value="302">302 – tạm thời</option>
				</SelectField>
				<TextField label="Ghi chú" value={form.note} error={errors.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} />
			</div>
			{message ? <Alert kind={message.kind}>{message.text}</Alert> : null}
			<button type="submit" className="tq-btn tq-btn--primary" disabled={busy} aria-busy={busy || undefined}>
				{busy ? "Đang thêm…" : "Thêm"}
			</button>
		</form>
	);
}

function ImportPanel({ onDone }: { onDone: () => void }) {
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState("");
	const [report, setReport] = useState<Report | null>(null);
	const parsed = parseRedirectList(text);

	async function loadFile(file: File | undefined) {
		if (!file) return;
		setProblem("");
		if (file.size > 500_000) return setProblem("Tệp quá lớn (tối đa 500 KB).");
		setText(await file.text());
		setReport(null);
	}
	async function send() {
		setProblem("");
		setReport(null);
		if (parsed.rows.length === 0) return setProblem("Chưa có dòng nào để nhập.");
		if (parsed.rows.length > MAX_ROWS) return setProblem(`Mỗi lần nhập tối đa ${MAX_ROWS} dòng (đang có ${parsed.rows.length}). Hãy chia tệp ra.`);
		setBusy(true);
		try {
			setReport(await api<Report>("POST", "redirects/import", { rows: parsed.rows }));
			onDone();
		} catch (caught) {
			setProblem(errorText(caught));
		} finally {
			setBusy(false);
		}
	}

	return (
		<details className="tq-panel">
			<summary style={{ cursor: "pointer", fontWeight: 600 }}>Nhập nhiều chuyển hướng cùng lúc</summary>
			<p className="tq-muted">Dán danh sách hoặc chọn tệp .csv / .txt: mỗi dòng một chuyển hướng dạng <code>/duong-dan-cu,/duong-dan-moi,301</code> (cột thứ ba có thể bỏ). Tối đa {MAX_ROWS} dòng. Dòng nào đã có sẽ được bỏ qua, không ghi đè.</p>
			<div className="tq-field">
				<label htmlFor="redirect-file" className="tq-label">Chọn tệp</label>
				<input id="redirect-file" type="file" accept=".csv,.txt,text/csv,text/plain" className="tq-input" onChange={(e) => void loadFile(e.target.files?.[0])} />
			</div>
			<div className="tq-field">
				<label htmlFor="redirect-list" className="tq-label">Danh sách</label>
				<textarea id="redirect-list" className="tq-input" rows={6} value={text} onChange={(e) => { setText(e.target.value); setReport(null); }} style={{ fontFamily: "ui-monospace, monospace" }} />
				<p className="tq-hint">{parsed.rows.length} dòng{parsed.skippedHeader ? " (đã bỏ dòng tiêu đề)" : ""}.</p>
			</div>
			{problem ? <Alert kind="error">{problem}</Alert> : null}
			<Button variant="primary" busy={busy} disabled={!text.trim()} onClick={() => void send()}>Nhập</Button>
			{report ? (
				<div style={{ marginTop: 16 }}>
					<Alert kind={report.errors ? "warning" : "success"}>Đã thêm {report.created}, bỏ qua {report.skipped}, lỗi {report.errors}.</Alert>
					{report.report.filter((line) => line.status !== "created").length ? (
						<div className="tq-table-wrap">
							<table className="tq-table">
								<caption className="tq-h2">Các dòng chưa thêm</caption>
								<thead>
									<tr>
										<th scope="col">Dòng</th>
										<th scope="col">Đường dẫn cũ</th>
										<th scope="col">Kết quả</th>
									</tr>
								</thead>
								<tbody>
									{report.report.filter((line) => line.status !== "created").map((line) => (
										<tr key={line.line}>
											<td>{line.line}</td>
											<td style={{ wordBreak: "break-all" }}>{line.from || "—"}</td>
											<td><Badge tone={line.status === "error" ? "danger" : "warn"}>{line.status === "error" ? "Lỗi" : "Bỏ qua"}</Badge> {line.message}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : null}
				</div>
			) : null}
		</details>
	);
}

function RowEditor({ row, onDone, onCancel }: { row: Row; onDone: () => void; onCancel: () => void }) {
	const [form, setForm] = useState({ to: row.to, code: String(row.code), note: row.note });
	const [busy, setBusy] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [error, setError] = useState("");
	async function save(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setErrors({});
		setError("");
		try {
			await api("PATCH", `redirects/${idOf(row.from)}`, { to: form.to, code: Number(form.code), note: form.note });
			onDone();
		} catch (caught) {
			setErrors(fieldErrors(caught));
			setError(errorText(caught));
		} finally {
			setBusy(false);
		}
	}
	return (
		<form onSubmit={(e) => void save(e)} noValidate aria-label={`Sửa chuyển hướng ${row.from}`}>
			<div className="tq-toolbar">
				<TextField label="Chuyển tới" value={form.to} error={errors.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
				<SelectField label="Loại" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}>
					<option value="301">301 – vĩnh viễn</option>
					<option value="302">302 – tạm thời</option>
				</SelectField>
				<TextField label="Ghi chú" value={form.note} error={errors.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
			</div>
			{error && !Object.keys(errors).length ? <Alert kind="error">{error}</Alert> : null}
			<div className="tq-actions">
				<button type="submit" className="tq-btn tq-btn--primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
				<Button variant="secondary" onClick={onCancel}>Hủy</Button>
			</div>
		</form>
	);
}

export function RedirectManager() {
	const { can } = useAdmin();
	const [q, setQ] = useState("");
	const [active, setActive] = useState("");
	const [editing, setEditing] = useState<string | null>(null);
	const [confirming, setConfirming] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

	const search = useDebounced(q.trim(), 300);
	const params = new URLSearchParams();
	if (search) params.set("q", search);
	if (active) params.set("active", active);
	const filterKey = params.toString();
	const [page, setPage] = usePage(filterKey);
	params.set("page", String(page));
	const query = params.toString();
	const list = useLoader(() => apiList<Row>(`redirects?${query}`), query);

	if (!can("redirects", "view")) return <NoRight />;

	async function toggle(row: Row) {
		setBusy(row.from);
		setMessage(null);
		try {
			await api("PATCH", `redirects/${idOf(row.from)}`, { active: !row.active });
			list.reload();
		} catch (caught) {
			setMessage({ kind: "error", text: errorText(caught) });
		} finally {
			setBusy(null);
		}
	}
	async function remove(row: Row) {
		setBusy(row.from);
		setMessage(null);
		try {
			await api("DELETE", `redirects/${idOf(row.from)}`);
			setConfirming(null);
			setMessage({ kind: "success", text: `Đã xóa chuyển hướng ${row.from}.` });
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
			<PageHeader title="Chuyển hướng 301" />
			<p className="tq-muted">Khi khách vào một đường dẫn cũ không còn trang, trang web đưa họ tới đường dẫn mới thay vì báo lỗi 404. Chỉ chuyển được tới chính website này.</p>

			{can("redirects", "create") ? <AddForm onDone={list.reload} /> : null}
			{can("redirects", "create") ? <ImportPanel onDone={list.reload} /> : null}

			<div className="tq-toolbar" role="search">
				<TextField label="Tìm kiếm" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Đường dẫn cũ, mới hoặc ghi chú" />
				<SelectField label="Trạng thái" value={active} onChange={(e) => setActive(e.target.value)}>
					<option value="">Tất cả</option>
					<option value="1">Đang bật</option>
					<option value="0">Đang tắt</option>
				</SelectField>
			</div>

			{message ? <Alert kind={message.kind}>{message.text}</Alert> : null}

			{list.error ? (
				<LoadError error={list.error} onRetry={list.reload} />
			) : !result ? (
				<Loading />
			) : result.rows.length === 0 ? (
				<EmptyState>{filterKey ? "Không có chuyển hướng nào khớp bộ lọc." : "Chưa có chuyển hướng nào."}</EmptyState>
			) : (
				<>
					<div className="tq-table-wrap" aria-busy={list.loading || undefined}>
						<table className="tq-table">
							<caption className="tq-h2">Danh sách chuyển hướng ({result.total})</caption>
							<thead>
								<tr>
									<th scope="col">Đường dẫn cũ</th>
									<th scope="col">Chuyển tới</th>
									<th scope="col">Loại</th>
									<th scope="col">Lượt dùng</th>
									<th scope="col">Thao tác</th>
								</tr>
							</thead>
							<tbody>
								{result.rows.map((row) => (
									<tr key={row.from}>
										<td style={{ wordBreak: "break-all" }}>
											<strong>{row.from}</strong>
											{!row.active ? <> <Badge tone="warn">Đang tắt</Badge></> : null}
											{row.note ? <><br /><span className="tq-muted">{row.note}</span></> : null}
										</td>
										<td style={{ wordBreak: "break-all" }}>{row.to}</td>
										<td>{row.code}</td>
										<td>{row.hits}</td>
										<td>
											{editing === row.from ? (
												<RowEditor row={row} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); list.reload(); }} />
											) : confirming === row.from ? (
												<div role="group" aria-label={`Xác nhận xóa ${row.from}`}>
													<p style={{ margin: "0 0 6px" }}>Xóa chuyển hướng này?</p>
													<div className="tq-actions">
														<Button variant="danger" busy={busy === row.from} onClick={() => void remove(row)}>Xóa</Button>
														<Button variant="secondary" disabled={busy === row.from} onClick={() => setConfirming(null)}>Không xóa</Button>
													</div>
												</div>
											) : (
												<div className="tq-actions">
													{can("redirects", "update") ? <Button className="tq-btn tq-btn--secondary tq-btn--small" variant="secondary" onClick={() => setEditing(row.from)} aria-label={`Sửa ${row.from}`}>Sửa</Button> : null}
													{can("redirects", "update") ? <Button className="tq-btn tq-btn--secondary tq-btn--small" variant="secondary" busy={busy === row.from} onClick={() => void toggle(row)} aria-label={`${row.active ? "Tắt" : "Bật"} ${row.from}`}>{row.active ? "Tắt" : "Bật"}</Button> : null}
													{can("redirects", "delete") ? <Button className="tq-btn tq-btn--danger tq-btn--small" variant="danger" onClick={() => setConfirming(row.from)} aria-label={`Xóa ${row.from}`}>Xóa</Button> : null}
												</div>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<Pager page={result.page} pageSize={result.pageSize} total={result.total} onPage={setPage} />
				</>
			)}
		</>
	);
}

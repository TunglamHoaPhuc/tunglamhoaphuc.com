"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, apiList } from "../api";
import { useAdmin } from "../AdminProvider";
import { useDebounced, useLoader } from "../media/imageTools";
import { Alert, Badge, Button, EmptyState, errorText, fieldErrors, Loading, PageHeader, SelectField, TextArea, TextField } from "../ui";
import { Feedback, moved, MoveButtons } from "./kit";

type Quote = { id: string; text: string; author: string; source: string; sourceUrl: string; active: boolean; position: number };
const BLANK = { text: "", author: "", source: "", sourceUrl: "", active: true };

function QuoteForm({ quote, canPublish, onDone, onCancel }: { quote: Quote | null; canPublish: boolean; onDone: (message: string) => void; onCancel: () => void }) {
	// Without the publish right a new quote starts switched off, and the switch is left as it is.
	const [form, setForm] = useState(quote ? { text: quote.text, author: quote.author, source: quote.source, sourceUrl: quote.sourceUrl, active: quote.active } : { ...BLANK, active: canPublish });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	async function save(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setFields({});
		try {
			if (quote) await api("PATCH", `quotes/${encodeURIComponent(quote.id)}`, form);
			else await api("POST", "quotes", form);
			onDone(quote ? "Đã lưu lời dạy." : "Đã thêm lời dạy.");
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
			setBusy(false);
		}
	}
	return (
		<form className="tq-panel" onSubmit={save} noValidate aria-label={quote ? "Sửa lời dạy" : "Thêm lời dạy"}>
			<Feedback error={error} />
			<TextArea label="Nội dung lời dạy" rows={4} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} error={fields.text} required />
			<TextField label="Tác giả" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} error={fields.author} maxLength={120} />
			<TextField label="Nguồn (kinh hoặc bài giảng)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} error={fields.source} maxLength={200} />
			<TextField label="Đường dẫn nguồn" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} error={fields.sourceUrl} hint="Tùy chọn, bắt đầu bằng / hoặc https://" />
			<label className="tq-check">
				<input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} disabled={!canPublish} />
				<span>Đang hiện{canPublish ? "" : " (cần quyền xuất bản để bật)"}</span>
			</label>
			<div className="tq-actions">
				<Button type="submit" busy={busy}>
					Lưu
				</Button>
				<Button variant="secondary" onClick={onCancel}>
					Hủy
				</Button>
			</div>
		</form>
	);
}

export function QuotesManager() {
	const { can } = useAdmin();
	const canPublish = can("quotes", "publish");
	const [q, setQ] = useState("");
	const [active, setActive] = useState("");
	const search = useDebounced(q.trim(), 300);
	const params = new URLSearchParams({ pageSize: "200" });
	if (search) params.set("q", search);
	if (active) params.set("active", active);
	const list = useLoader(() => apiList<Quote>(`quotes?${params}`), `quotes-${params}`);
	// Which source the home page shows is the Trang chủ module's: without its "view" right nothing is asked and the note is left out.
	const canHome = can("home", "view");
	const setting = useLoader(() => (canHome ? api<{ blocks: { block: string; live: { source?: string; mode?: string } | null }[] }>("GET", "home") : Promise.resolve(null)), `home-quotes-${canHome}`);
	const [editing, setEditing] = useState<Quote | "new" | null>(null);
	const [asking, setAsking] = useState("");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [busy, setBusy] = useState("");
	const rows = list.data?.rows ?? [];
	const filtered = Boolean(search || active);
	const live = setting.data?.blocks.find((block) => block.block === "quotes")?.live;

	async function run(key: string, action: () => Promise<void>, message: string) {
		setBusy(key);
		setError("");
		setNotice("");
		try {
			await action();
			setNotice(message);
			list.reload();
		} catch (caught) {
			setError(errorText(caught));
		} finally {
			setBusy("");
		}
	}

	return (
		<>
			<PageHeader title="Lời Thầy dạy">
				{can("quotes", "create") ? <Button onClick={() => setEditing("new")}>Thêm lời dạy</Button> : null}
			</PageHeader>
			{canHome ? (
				<Alert kind="info">
					{live?.source === "trich-dan" ? "Trang chủ đang hiện các lời dạy đang bật dưới đây" : "Trang chủ đang hiện câu kệ của chủ đề từng tháng"}
					{live?.source === "trich-dan" ? (live.mode === "ngau-nhien" ? ", theo thứ tự ngẫu nhiên mỗi lượt xem." : ", theo đúng thứ tự." ) : ". "}{" "}
					Đổi nguồn tại <Link href="/quan-tri/trang-chu">Trang chủ</Link>.
				</Alert>
			) : null}
			<Feedback error={error} notice={notice} />
			{editing ? (
				<QuoteForm
					key={editing === "new" ? "new" : editing.id}
					quote={editing === "new" ? null : editing}
					canPublish={canPublish}
					onCancel={() => setEditing(null)}
					onDone={(message) => {
						setEditing(null);
						setNotice(message);
						list.reload();
					}}
				/>
			) : null}
			<div className="tq-toolbar" role="search">
				<TextField label="Tìm kiếm" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nội dung, tác giả hoặc nguồn" />
				<SelectField label="Trạng thái" value={active} onChange={(e) => setActive(e.target.value)}>
					<option value="">Tất cả</option>
					<option value="1">Đang hiện</option>
					<option value="0">Đang tắt</option>
				</SelectField>
			</div>
			{list.error ? (
				<>
					<Alert kind="error">{list.error}</Alert>
					<Button variant="secondary" onClick={list.reload}>
						Thử lại
					</Button>
				</>
			) : !list.data ? (
				<Loading />
			) : rows.length === 0 ? (
				<EmptyState>{filtered ? "Không có lời dạy nào khớp." : "Chưa có lời dạy nào."}</EmptyState>
			) : (
				<ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
					{rows.map((row, index) => (
						<li key={row.id} className="tq-panel" style={{ margin: 0 }}>
							<blockquote style={{ margin: "0 0 8px" }}>{row.text}</blockquote>
							<p className="tq-muted" style={{ margin: "0 0 8px" }}>
								{[row.author, row.source].filter(Boolean).join(" · ") || "Chưa ghi tác giả"} {row.active ? <Badge tone="ok">Đang hiện</Badge> : <Badge tone="warn">Đang tắt</Badge>}
							</p>
							{can("quotes", "update") && !canPublish && row.active ? <p className="tq-hint">Lời dạy này đang hiện trên trang chủ. Chỉ người có quyền xuất bản mới sửa, tắt hoặc xóa được.</p> : null}
							{can("quotes", "update") ? (
								<div className="tq-actions">
									{!filtered ? (
										<MoveButtons
											index={index}
											length={rows.length}
											label={`lời dạy ${index + 1}`}
											onMove={(to) =>
												void run("move", () => api("POST", "quotes/reorder", { ids: moved(rows, index, to).map((item) => item.id) }), "Đã đổi thứ tự.")
											}
										/>
									) : null}
									{canPublish ? (
										<Button variant="secondary" busy={busy === `t-${row.id}`} onClick={() => void run(`t-${row.id}`, () => api("PATCH", `quotes/${row.id}`, { active: !row.active }), row.active ? "Đã tắt lời dạy." : "Đã bật lời dạy.")}>
											{row.active ? "Tắt" : "Bật"}
										</Button>
									) : null}
									{canPublish || !row.active ? (
										<Button variant="secondary" onClick={() => setEditing(row)}>
											Sửa
										</Button>
									) : null}
									{can("quotes", "delete") && (canPublish || !row.active) ? (
										asking === row.id ? (
											<>
												<Button variant="danger" busy={busy === `d-${row.id}`} onClick={() => void run(`d-${row.id}`, async () => void (await api("DELETE", `quotes/${row.id}`), setAsking("")), "Đã chuyển lời dạy vào thùng rác.")}>
													Chuyển vào thùng rác
												</Button>
												<Button variant="secondary" onClick={() => setAsking("")}>
													Không xóa
												</Button>
											</>
										) : (
											<Button variant="danger" onClick={() => setAsking(row.id)}>
												Xóa
											</Button>
										)
									) : null}
								</div>
							) : null}
						</li>
					))}
				</ol>
			)}
			{filtered ? <p className="tq-hint">Bỏ bộ lọc để đổi thứ tự.</p> : null}
		</>
	);
}

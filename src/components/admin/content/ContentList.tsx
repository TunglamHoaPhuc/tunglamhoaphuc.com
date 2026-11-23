"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, apiList } from "../api";
import { useAdmin } from "../AdminProvider";
import { useDebounced, useLoader, usePage } from "../media/imageTools";
import { Alert, Badge, Button, EmptyState, errorText, Loading, PageHeader, Pager, SelectField, TextField, when } from "../ui";
import { KIND_UI, STATUS_LABELS, STATUS_TONES, type ContentDetail, type Counts, type KindName, type ListRow, type Options, type Status } from "./types";

const TABS: ("" | Status)[] = ["", "draft", "pending", "scheduled", "published", "hidden"];

const formatDay = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10).split("-").reverse().join("/") : "—");

/** The list of one kind of article: status tabs with their counts, filters, search, pages and the actions on each row. */
export function ContentList({ kind }: { kind: KindName }) {
	const ui = KIND_UI[kind];
	const { can, me } = useAdmin();
	const router = useRouter();
	const [q, setQ] = useState("");
	const [status, setStatus] = useState<"" | Status>("");
	const [section, setSection] = useState("");
	const [categoryId, setCategoryId] = useState("");
	const [authorId, setAuthorId] = useState("");
	const [pinned, setPinned] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [sort, setSort] = useState(ui.hasPosition ? "position" : "-updatedAt");
	const [confirming, setConfirming] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	const [picked, setPicked] = useState<Set<string>>(new Set());
	const [bulkConfirm, setBulkConfirm] = useState(false);
	const [bulkBusy, setBulkBusy] = useState(false);
	const search = useDebounced(q.trim(), 300);

	const filters = new URLSearchParams();
	if (search) filters.set("q", search);
	if (section) filters.set("section", section);
	if (categoryId) filters.set("categoryId", categoryId);
	if (authorId) filters.set("authorId", authorId);
	if (pinned) filters.set("pinned", pinned);
	if (from) filters.set("from", from);
	if (to) filters.set("to", to);
	const filterKey = filters.toString();
	const listParams = new URLSearchParams(filters);
	if (status) listParams.set("status", status);
	listParams.set("sort", sort);
	const [page, setPage] = usePage(listParams.toString());
	listParams.set("page", String(page));
	const query = listParams.toString();

	const options = useLoader(() => api<Options>("GET", `${kind}/options`), `${kind}-options`);
	const counts = useLoader(() => api<Counts>("GET", `${kind}/counts?${filterKey}`), `${kind}-counts-${filterKey}`);
	const list = useLoader(() => apiList<ListRow>(`${kind}?${query}`), `${kind}-${query}`);
	const result = list.data;
	const categories = (options.data?.categories ?? []).filter((item) => !ui.hasSection || !section || item.section === section);
	const anyFilter = !!(search || section || categoryId || authorId || pinned || from || to || status);

	async function duplicate(row: ListRow) {
		setBusy(row.id);
		setNotice(null);
		try {
			const copy = await api<ContentDetail>("POST", `${kind}/${encodeURIComponent(row.id)}/duplicate`, {});
			router.push(`/quan-tri/${ui.path}/${encodeURIComponent(copy.id)}`);
		} catch (error) {
			setNotice({ kind: "error", text: errorText(error) });
			setBusy(null);
		}
	}

	/** Bulk actions run the single-article endpoints one by one, so every article is checked (permission, version, log) exactly as on its own. */
	async function bulk(action: "publish" | "delete") {
		const rows = (result?.rows ?? []).filter((row) => picked.has(row.id) && (action === "delete" ? row.canDelete : row.status !== "published"));
		if (rows.length === 0) {
			setNotice({ kind: "error", text: action === "delete" ? "Không có bài đã chọn mà anh/chị được phép xóa." : "Các bài đã chọn đều đã xuất bản." });
			setBulkConfirm(false);
			return;
		}
		setBulkBusy(true);
		setNotice(null);
		const failed: string[] = [];
		for (const row of rows) {
			try {
				if (action === "delete") await api("DELETE", `${kind}/${encodeURIComponent(row.id)}`);
				else await api("POST", `${kind}/${encodeURIComponent(row.id)}/publish`, { version: row.version });
			} catch (error) {
				failed.push(`"${row.title}": ${errorText(error)}`);
			}
		}
		const done = rows.length - failed.length;
		const verb = action === "delete" ? "chuyển vào thùng rác" : "xuất bản";
		setNotice({ kind: failed.length ? "error" : "success", text: `Đã ${verb} ${done}/${rows.length} bài.${failed.length ? ` Không làm được: ${failed.join("; ")}` : ""}` });
		setPicked(new Set());
		setBulkConfirm(false);
		setBulkBusy(false);
		list.reload();
		counts.reload();
	}

	async function remove(row: ListRow) {
		setBusy(row.id);
		setNotice(null);
		try {
			await api("DELETE", `${kind}/${encodeURIComponent(row.id)}`);
			setNotice({ kind: "success", text: `Đã chuyển "${row.title}" vào thùng rác.` });
			setConfirming(null);
			list.reload();
			counts.reload();
		} catch (error) {
			setNotice({ kind: "error", text: errorText(error) });
		} finally {
			setBusy(null);
		}
	}

	return (
		<>
			<PageHeader title={ui.title}>
				{can(kind, "create") ? (
					<Link href={`/quan-tri/${ui.path}/moi`} className="tq-btn tq-btn--primary">
						{ui.addLabel}
					</Link>
				) : null}
			</PageHeader>

			<nav aria-label="Lọc theo trạng thái" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
				{TABS.map((tab) => {
					const count = counts.data ? counts.data[tab || "all"] : null;
					const active = status === tab;
					return (
						<button key={tab || "all"} type="button" className={`tq-btn tq-btn--small ${active ? "tq-btn--primary" : "tq-btn--secondary"}`} aria-pressed={active} onClick={() => setStatus(tab)}>
							{tab ? STATUS_LABELS[tab] : "Tất cả"}
							{count !== null ? ` (${count})` : ""}
						</button>
					);
				})}
			</nav>

			<div className="tq-toolbar" role="search" style={{ marginBottom: 14 }}>
				<TextField label="Tìm kiếm" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tiêu đề hoặc nội dung, gõ có dấu hay không đều được" />
				{ui.hasSection ? (
					<SelectField
						label="Chuyên trang"
						value={section}
						onChange={(e) => {
							setSection(e.target.value);
							setCategoryId("");
						}}
					>
						<option value="">Tất cả</option>
						{(options.data?.sections ?? []).map((item) => (
							<option key={item.slug} value={item.slug}>
								{item.name}
							</option>
						))}
					</SelectField>
				) : null}
				<SelectField label={ui.categoryLabel} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
					<option value="">Tất cả</option>
					<option value="none">Chưa chọn</option>
					{categories.map((item) => (
						<option key={item.id} value={item.id}>
							{item.name}
						</option>
					))}
				</SelectField>
				<SelectField label="Người tạo" value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
					<option value="">Tất cả</option>
					<option value={me.user.id}>Bài của tôi</option>
					{(options.data?.authors ?? [])
						.filter((item) => item.id !== me.user.id)
						.map((item) => (
							<option key={item.id} value={item.id}>
								{item.name}
							</option>
						))}
				</SelectField>
				{ui.hasPinned ? (
					<SelectField label="Ghim" value={pinned} onChange={(e) => setPinned(e.target.value)}>
						<option value="">Tất cả</option>
						<option value="1">Đã ghim</option>
						<option value="0">Không ghim</option>
					</SelectField>
				) : null}
				<TextField label={ui.hasDate ? "Đăng từ ngày" : "Sửa từ ngày"} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
				<TextField label="Đến ngày" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
				<SelectField label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value)}>
					{ui.hasPosition ? <option value="position">Theo thứ tự hiển thị</option> : null}
					<option value="-updatedAt">Sửa gần nhất</option>
					{ui.hasDate ? <option value="-publishedDate">Ngày đăng mới nhất</option> : null}
					{ui.hasDate ? <option value="publishedDate">Ngày đăng cũ nhất</option> : null}
					<option value="title">Tiêu đề A–Z</option>
					<option value="-title">Tiêu đề Z–A</option>
				</SelectField>
			</div>

			{notice ? <Alert kind={notice.kind}>{notice.text}</Alert> : null}

			{list.error ? (
				<>
					<Alert kind="error">{list.error}</Alert>
					<Button variant="secondary" onClick={list.reload}>
						Thử lại
					</Button>
				</>
			) : !result ? (
				<Loading />
			) : result.rows.length === 0 ? (
				<EmptyState>{anyFilter ? `Không có ${ui.one} nào khớp bộ lọc.` : `Chưa có ${ui.one} nào.`}</EmptyState>
			) : (
				<>
					{picked.size > 0 ? (
						<div role="group" aria-label="Thao tác hàng loạt" className="tq-toolbar" style={{ marginBottom: 10, alignItems: "center" }}>
							<strong>Đã chọn {picked.size} bài</strong>
							{can(kind, "publish") ? (
								<Button variant="secondary" disabled={bulkBusy} onClick={() => void bulk("publish")}>
									Xuất bản các bài đã chọn
								</Button>
							) : null}
							{can(kind, "delete") ? (
								bulkConfirm ? (
									<span role="group" aria-label="Xác nhận xóa hàng loạt" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
										<span>Chuyển {picked.size} bài vào thùng rác?</span>
										<Button variant="danger" disabled={bulkBusy} onClick={() => void bulk("delete")}>
											Xóa
										</Button>
										<Button variant="secondary" onClick={() => setBulkConfirm(false)}>
											Hủy
										</Button>
									</span>
								) : (
									<Button variant="secondary" disabled={bulkBusy} onClick={() => setBulkConfirm(true)}>
										Xóa các bài đã chọn
									</Button>
								)
							) : null}
							<Button variant="secondary" onClick={() => setPicked(new Set())}>
								Bỏ chọn
							</Button>
						</div>
					) : null}
					<div className="tq-table-wrap" aria-busy={list.loading || undefined}>
						<table className="tq-table">
							<caption className="tq-h2" style={{ textAlign: "left" }}>
								{ui.title} ({result.total})
							</caption>
							<thead>
								<tr>
									<th scope="col" style={{ width: 36 }}>
										<input
											type="checkbox"
											aria-label="Chọn tất cả bài trên trang này"
											checked={result.rows.length > 0 && result.rows.every((row) => picked.has(row.id))}
											onChange={(e) => setPicked(e.target.checked ? new Set(result.rows.map((row) => row.id)) : new Set())}
										/>
									</th>
									<th scope="col">Tiêu đề</th>
									<th scope="col">{ui.categoryLabel}</th>
									<th scope="col">Trạng thái</th>
									<th scope="col">{ui.hasDate ? "Ngày đăng" : "Thứ tự"}</th>
									<th scope="col">Sửa lần cuối</th>
									<th scope="col">
										<span className="tq-muted">Thao tác</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{result.rows.map((row) => (
									<tr key={row.id}>
										<td>
											<input
												type="checkbox"
												aria-label={`Chọn ${row.title}`}
												checked={picked.has(row.id)}
												onChange={(e) =>
													setPicked((now) => {
														const next = new Set(now);
														if (e.target.checked) next.add(row.id);
														else next.delete(row.id);
														return next;
													})
												}
											/>
										</td>
										<td style={{ minWidth: 220 }}>
											<div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
												{row.thumbUrl ? <img src={row.thumbUrl} alt="" width={56} height={42} loading="lazy" style={{ objectFit: "cover", borderRadius: 6, flex: "none" }} /> : null}
												<div>
													<Link href={`/quan-tri/${ui.path}/${encodeURIComponent(row.id)}`}>
														<strong>{row.title || "(chưa có tiêu đề)"}</strong>
													</Link>
													{row.pinned ? (
														<>
															{" "}
															<Badge tone="ok">Ghim</Badge>
														</>
													) : null}
													<br />
													<span className="tq-muted" style={{ fontSize: 13, wordBreak: "break-all" }}>
														{ui.publicPath(row)}
													</span>
												</div>
											</div>
										</td>
										<td>{row.categoryName || "—"}</td>
										<td>
											<Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
											{row.status === "scheduled" && row.publishAt ? (
												<>
													<br />
													<span className="tq-muted" style={{ fontSize: 13 }}>
														{when(row.publishAt)}
													</span>
												</>
											) : null}
										</td>
										<td>{ui.hasDate ? formatDay(row.publishedDate) : (row.position ?? "—")}</td>
										<td>
											{when(row.updatedAt)}
											{row.updatedByName ? (
												<>
													<br />
													<span className="tq-muted" style={{ fontSize: 13 }}>
														{row.updatedByName}
													</span>
												</>
											) : null}
										</td>
										<td>
											<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
												<Link className="tq-btn tq-btn--secondary tq-btn--small" href={`/quan-tri/${ui.path}/${encodeURIComponent(row.id)}`} aria-label={`${row.canUpdate ? "Sửa" : "Xem"} ${row.title}`}>
													{row.canUpdate ? "Sửa" : "Xem"}
												</Link>
												{can(kind, "create") ? (
													<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" disabled={busy === row.id} onClick={() => void duplicate(row)} aria-label={`Nhân bản ${row.title}`}>
														Nhân bản
													</button>
												) : null}
												{row.canDelete ? (
													confirming === row.id ? (
														<span role="group" aria-label={`Xác nhận xóa ${row.title}`} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
															<span>Chuyển vào thùng rác?</span>
															<button type="button" className="tq-btn tq-btn--danger tq-btn--small" disabled={busy === row.id} onClick={() => void remove(row)}>
																Xóa
															</button>
															<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => setConfirming(null)}>
																Hủy
															</button>
														</span>
													) : (
														<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => setConfirming(row.id)} aria-label={`Xóa ${row.title}`}>
															Xóa
														</button>
													)
												) : null}
											</div>
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

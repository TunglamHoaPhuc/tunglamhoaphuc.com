"use client";

import Link from "next/link";
import { useState } from "react";
import { api, apiList } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useDebounced, useLoader, usePage } from "@/components/admin/media/imageTools";
import { CalendarMonth, shiftMonth, type CalendarEvent } from "@/components/admin/special/CalendarMonth";
import { dateVn } from "@/components/admin/special/kit";
import { Alert, Badge, Button, EmptyState, Loading, PageHeader, Pager, SelectField, TextField } from "@/components/admin/ui";

type Row = CalendarEvent & { slug: string; location: string; registrationStatus: string; lunar: { day: number; month: number; leap: boolean } | null };
type Category = { id: string; name: string };

const STATUS: Record<string, string> = { published: "Đã xuất bản", draft: "Bản nháp", hidden: "Tạm ẩn", pending: "Chờ duyệt", scheduled: "Hẹn giờ" };
const todayVn = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

export default function EventsPage() {
	const { can } = useAdmin();
	const [view, setView] = useState<"lich" | "danh-sach">("lich");
	const [month, setMonth] = useState(() => todayVn().slice(0, 7));
	const [allMonths, setAllMonths] = useState(false);
	const [category, setCategory] = useState("");
	const [status, setStatus] = useState("");
	const [q, setQ] = useState("");
	const search = useDebounced(q.trim(), 300);

	const params = new URLSearchParams();
	if (view === "lich" || !allMonths) params.set("month", month);
	if (category) params.set("category", category);
	if (status) params.set("status", status);
	if (search) params.set("q", search);
	const filterKey = `${view}|${params.toString()}`;
	const [page, setPage] = usePage(filterKey);
	params.set("pageSize", view === "lich" ? "200" : "30");
	if (view === "danh-sach") params.set("page", String(page));
	const query = params.toString();
	const list = useLoader(() => apiList<Row>(`events?${query}`), `events-${query}`);
	const categories = useLoader(() => api<{ categories: Category[] }>("GET", "events/categories"), "event-categories");
	const result = list.data;
	const today = todayVn();

	return (
		<>
			<PageHeader title="Lịch tu học và sự kiện">
				{can("events", "create") ? (
					<Link href="/quan-tri/lich-tu-hoc/moi" className="tq-btn tq-btn--primary">
						Thêm sự kiện
					</Link>
				) : null}
				<Link href="/quan-tri/lich-tu-hoc/chu-de" className="tq-btn tq-btn--secondary">
					Chủ đề tháng và chương trình định kỳ
				</Link>
			</PageHeader>

			<div className="tq-toolbar" role="search">
				<div className="tq-field">
					<span className="tq-label" id="ev-view">
						Cách xem
					</span>
					<div className="tq-actions" role="group" aria-labelledby="ev-view">
						<Button variant={view === "lich" ? "primary" : "secondary"} aria-pressed={view === "lich"} onClick={() => setView("lich")}>
							Lịch tháng
						</Button>
						<Button variant={view === "danh-sach" ? "primary" : "secondary"} aria-pressed={view === "danh-sach"} onClick={() => setView("danh-sach")}>
							Danh sách
						</Button>
					</div>
				</div>
				<TextField label="Tháng" type="month" value={month} disabled={view === "danh-sach" && allMonths} onChange={(e) => e.target.value && setMonth(e.target.value)} />
				{view === "danh-sach" ? (
					<label className="tq-check">
						<input type="checkbox" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} />
						<span>Mọi tháng</span>
					</label>
				) : null}
				<SelectField label="Loại" value={category} onChange={(e) => setCategory(e.target.value)}>
					<option value="">Tất cả</option>
					{(categories.data?.categories ?? []).map((item) => (
						<option key={item.id} value={item.id}>
							{item.name}
						</option>
					))}
				</SelectField>
				<SelectField label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value)}>
					<option value="">Tất cả</option>
					<option value="published">Đã xuất bản</option>
					<option value="draft">Bản nháp</option>
					<option value="hidden">Tạm ẩn</option>
				</SelectField>
				<TextField label="Tìm" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tiêu đề hoặc địa điểm" />
			</div>

			{view === "lich" ? (
				<div className="tq-actions" style={{ marginBottom: 12 }}>
					<Button variant="secondary" onClick={() => setMonth(shiftMonth(month, -1))}>
						← Tháng trước
					</Button>
					<strong aria-live="polite" style={{ alignSelf: "center" }}>
						Tháng {month.slice(5)}/{month.slice(0, 4)}
					</strong>
					<Button variant="secondary" onClick={() => setMonth(shiftMonth(month, 1))}>
						Tháng sau →
					</Button>
				</div>
			) : null}

			{list.error ? (
				<>
					<Alert kind="error">{list.error}</Alert>
					<Button variant="secondary" onClick={list.reload}>
						Thử lại
					</Button>
				</>
			) : !result ? (
				<Loading />
			) : view === "lich" ? (
				<>
					<CalendarMonth month={month} events={result.rows} today={today} canCreate={can("events", "create")} />
					{result.rows.length === 0 ? <EmptyState>Tháng này chưa có sự kiện nào.</EmptyState> : null}
				</>
			) : result.rows.length === 0 ? (
				<EmptyState>Không có sự kiện nào khớp.</EmptyState>
			) : (
				<>
					<div className="tq-table-wrap">
						<table className="tq-table">
							<thead>
								<tr>
									<th scope="col">Sự kiện</th>
									<th scope="col">Ngày</th>
									<th scope="col">Âm lịch</th>
									<th scope="col">Loại</th>
									<th scope="col">Trạng thái</th>
								</tr>
							</thead>
							<tbody>
								{result.rows.map((row) => (
									<tr key={row.id}>
										<td>
											<Link href={`/quan-tri/lich-tu-hoc/${row.id}`}>{row.title}</Link>
											{row.location ? <div className="tq-muted">{row.location}</div> : null}
										</td>
										<td>{row.startDate === row.endDate ? dateVn(row.startDate) : `${dateVn(row.startDate)} – ${dateVn(row.endDate)}`}</td>
										<td>{row.lunar ? `${row.lunar.day}/${row.lunar.month}${row.lunar.leap ? " nhuận" : ""}` : "—"}</td>
										<td>{row.categoryName || "—"}</td>
										<td>
											<Badge tone={row.status === "published" ? "ok" : row.status === "hidden" ? "warn" : "neutral"}>{STATUS[row.status] ?? row.status}</Badge>
											{row.registrationStatus === "open" ? <Badge tone="ok">Mở đăng ký</Badge> : null}
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

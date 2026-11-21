"use client";

import Link from "next/link";
import { useState } from "react";
import { api, apiList } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useDebounced, useLoader, usePage } from "@/components/admin/media/imageTools";
import { Alert, Badge, Button, EmptyState, Loading, PageHeader, Pager, SelectField, TextField } from "@/components/admin/ui";

type Row = { id: string; name: string; code: string; subtitle: string; imageUrl: string; assemblyName: string; areaName: string; isMain: boolean; status: string };
type Options = { assemblies: { id: string; name: string }[]; areas: { id: string; name: string }[] };

const STATUS: Record<string, string> = { published: "Đã xuất bản", draft: "Bản nháp", hidden: "Tạm ẩn", pending: "Chờ duyệt", scheduled: "Hẹn giờ" };

export default function StatuesPage() {
	const { can } = useAdmin();
	const [q, setQ] = useState("");
	const [assembly, setAssembly] = useState("");
	const [area, setArea] = useState("");
	const [main, setMain] = useState("");
	const [status, setStatus] = useState("");
	const search = useDebounced(q.trim(), 300);
	const params = new URLSearchParams();
	if (search) params.set("q", search);
	if (assembly) params.set("assembly", assembly);
	if (area) params.set("area", area);
	if (main) params.set("main", main);
	if (status) params.set("status", status);
	const [page, setPage] = usePage(params.toString());
	params.set("page", String(page));
	params.set("pageSize", "30");
	const query = params.toString();
	const list = useLoader(() => apiList<Row>(`statues?${query}`), `statues-${query}`);
	const options = useLoader(() => api<Options>("GET", "statues/options"), "statue-options");
	const result = list.data;

	return (
		<>
			<PageHeader title="Bảo tượng">
				{can("statues", "create") ? (
					<Link href="/quan-tri/bao-tuong/moi" className="tq-btn tq-btn--primary">
						Thêm bảo tượng
					</Link>
				) : null}
			</PageHeader>
			<div className="tq-toolbar" role="search">
				<TextField label="Tìm kiếm" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên hoặc mã tượng" />
				<SelectField label="Chúng hội" value={assembly} onChange={(e) => setAssembly(e.target.value)}>
					<option value="">Tất cả</option>
					{(options.data?.assemblies ?? []).map((item) => (
						<option key={item.id} value={item.id}>
							{item.name}
						</option>
					))}
				</SelectField>
				<SelectField label="Khu vực" value={area} onChange={(e) => setArea(e.target.value)}>
					<option value="">Tất cả</option>
					{(options.data?.areas ?? []).map((item) => (
						<option key={item.id} value={item.id}>
							{item.name}
						</option>
					))}
				</SelectField>
				<SelectField label="Loại" value={main} onChange={(e) => setMain(e.target.value)}>
					<option value="">Tất cả</option>
					<option value="1">Tượng chính</option>
					<option value="0">Tác phẩm nghệ thuật</option>
				</SelectField>
				<SelectField label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value)}>
					<option value="">Tất cả</option>
					<option value="published">Đã xuất bản</option>
					<option value="draft">Bản nháp</option>
					<option value="hidden">Tạm ẩn</option>
				</SelectField>
			</div>
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
				<EmptyState>Không có bảo tượng nào khớp.</EmptyState>
			) : (
				<>
					<div className="tq-table-wrap">
						<table className="tq-table">
							<thead>
								<tr>
									<th scope="col">Ảnh</th>
									<th scope="col">Bảo tượng</th>
									<th scope="col">Mã</th>
									<th scope="col">Chúng hội</th>
									<th scope="col">Khu vực</th>
									<th scope="col">Trạng thái</th>
								</tr>
							</thead>
							<tbody>
								{result.rows.map((row) => (
									<tr key={row.id}>
										<td>{row.imageUrl ? <img src={row.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }} /> : null}</td>
										<td>
											<Link href={`/quan-tri/bao-tuong/${row.id}`}>{row.name}</Link>
											{row.subtitle ? <div className="tq-muted">{row.subtitle}</div> : null}
											{!row.isMain ? <Badge>Tác phẩm nghệ thuật</Badge> : null}
										</td>
										<td>{row.code || "—"}</td>
										<td>{row.assemblyName || "—"}</td>
										<td>{row.areaName || "—"}</td>
										<td>
											<Badge tone={row.status === "published" ? "ok" : row.status === "hidden" ? "warn" : "neutral"}>{STATUS[row.status] ?? row.status}</Badge>
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

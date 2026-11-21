"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useLoader } from "@/components/admin/media/imageTools";
import { Feedback, moved, MoveButtons } from "@/components/admin/special/kit";
import { Alert, Badge, Button, EmptyState, errorText, Loading, PageHeader } from "@/components/admin/ui";

type Row = { id: string; name: string; subtitle: string; coverUrl: string; visible: boolean; featured: boolean; featuredPosition: number; statueCount: number; mapX: number | null };

export default function AreasPage() {
	const { can } = useAdmin();
	const list = useLoader(() => api<{ areas: Row[] }>("GET", "areas"), "areas");
	const [order, setOrder] = useState<string[] | null>(null);
	const [seen, setSeen] = useState<unknown>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const areas = list.data?.areas ?? [];
	if (list.data && list.data !== seen) {
		setSeen(list.data);
		setOrder([...list.data.areas].filter((area) => area.featured).sort((a, b) => a.featuredPosition - b.featuredPosition).map((area) => area.id));
	}
	const byId = new Map(areas.map((area) => [area.id, area]));
	const canEdit = can("areas", "update");

	async function saveFeatured() {
		setBusy(true);
		setError("");
		setNotice("");
		try {
			await api("PUT", "areas/featured", { ids: order });
			setNotice("Đã lưu danh sách khu vực nổi bật.");
			list.reload();
		} catch (caught) {
			setError(errorText(caught));
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<PageHeader title="Khu vực (Vũ Trụ Phật Giáo)" />
			{list.error ? (
				<>
					<Alert kind="error">{list.error}</Alert>
					<Button variant="secondary" onClick={list.reload}>
						Thử lại
					</Button>
				</>
			) : !list.data || !order ? (
				<Loading />
			) : (
				<>
					<section className="tq-panel" aria-labelledby="kv-featured">
						<h2 className="tq-h2" id="kv-featured">
							Khu vực nổi bật trên trang chủ
						</h2>
						<Feedback error={error} notice={notice} />
						{order.length === 0 ? <EmptyState>Chưa chọn khu vực nổi bật nào.</EmptyState> : null}
						<ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
							{order.map((id, index) => (
								<li key={id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
									<span style={{ flex: 1 }}>{byId.get(id)?.name ?? id}</span>
									{canEdit ? (
										<>
											<MoveButtons index={index} length={order.length} label={byId.get(id)?.name ?? id} onMove={(to) => setOrder(moved(order, index, to))} />
											<Button variant="secondary" onClick={() => setOrder(order.filter((item) => item !== id))} aria-label={`Bỏ ${byId.get(id)?.name ?? id} khỏi nổi bật`}>
												Bỏ
											</Button>
										</>
									) : null}
								</li>
							))}
						</ol>
						{canEdit ? (
							<Button busy={busy} onClick={() => void saveFeatured()}>
								Lưu danh sách nổi bật
							</Button>
						) : null}
					</section>

					<div className="tq-table-wrap">
						<table className="tq-table">
							<thead>
								<tr>
									<th scope="col">Khu vực</th>
									<th scope="col">Số bảo tượng</th>
									<th scope="col">Ghim bản đồ</th>
									<th scope="col">Trạng thái</th>
									<th scope="col">Nổi bật</th>
								</tr>
							</thead>
							<tbody>
								{areas.map((area) => (
									<tr key={area.id}>
										<td>
											<Link href={`/quan-tri/khu-vuc/${area.id}`}>{area.name}</Link>
											{area.subtitle ? <div className="tq-muted">{area.subtitle}</div> : null}
										</td>
										<td>{area.statueCount}</td>
										<td>{area.mapX === null ? "Chưa đặt" : "Đã đặt"}</td>
										<td>{area.visible ? <Badge tone="ok">Đang hiện</Badge> : <Badge tone="warn">Đang ẩn</Badge>}</td>
										<td>
											{order.includes(area.id) ? (
												<Badge tone="ok">Có</Badge>
											) : canEdit && order.length < 12 ? (
												<Button variant="secondary" onClick={() => setOrder([...order, area.id])} aria-label={`Thêm ${area.name} vào nổi bật`}>
													Thêm
												</Button>
											) : (
												"—"
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}
		</>
	);
}

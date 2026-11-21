"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { Alert, Badge, Button, EmptyState, errorText, Loading, PageHeader } from "@/components/admin/ui";

type RoleRow = { id: string; name: string; description: string; isSystem: boolean; users: number };

export default function RolesPage() {
	const { can } = useAdmin();
	const mayView = can("roles", "view");
	const [roles, setRoles] = useState<RoleRow[] | null>(null);
	const [error, setError] = useState("");
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		if (!mayView) return;
		let active = true;
		api<{ roles: RoleRow[] }>("GET", "roles")
			.then((data) => {
				if (active) {
					setRoles(data.roles);
					setError("");
				}
			})
			.catch((caught: unknown) => {
				if (active) setError(errorText(caught));
			});
		return () => {
			active = false;
		};
	}, [mayView, attempt]);

	function retry() {
		setError("");
		setRoles(null);
		setAttempt((n) => n + 1);
	}

	return (
		<>
			<PageHeader title="Vai trò và quyền">
				{can("roles", "create") ? <Link href="/quan-tri/vai-tro/moi" className="tq-btn">Thêm vai trò</Link> : null}
			</PageHeader>
			{!mayView ? (
				<Alert kind="warning">Bạn không có quyền xem danh sách vai trò.</Alert>
			) : error ? (
				<>
					<Alert kind="error">{error}</Alert>
					<Button variant="secondary" onClick={retry}>Thử lại</Button>
				</>
			) : !roles ? (
				<Loading />
			) : roles.length === 0 ? (
				<EmptyState>Chưa có vai trò nào.</EmptyState>
			) : (
				<div className="tq-table-wrap">
					<table className="tq-table">
						<caption className="tq-muted" style={{ textAlign: "left", padding: "10px 14px" }}>{roles.length} vai trò</caption>
						<thead>
							<tr>
								<th scope="col">Vai trò</th>
								<th scope="col">Loại</th>
								<th scope="col">Số tài khoản</th>
							</tr>
						</thead>
						<tbody>
							{roles.map((role) => (
								<tr key={role.id}>
									<td>
										<Link href={`/quan-tri/vai-tro/${encodeURIComponent(role.id)}`}><strong>{role.name}</strong></Link>
										{role.description ? <div className="tq-muted">{role.description}</div> : null}
									</td>
									<td>{role.isSystem ? <Badge tone="ok">Vai trò mẫu</Badge> : <span className="tq-muted">Tự tạo</span>}</td>
									<td>{role.users}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</>
	);
}

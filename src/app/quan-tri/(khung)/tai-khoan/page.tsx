"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiList } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { Alert, Badge, Button, EmptyState, errorText, Loading, PageHeader, Pager, SelectField, TextField, when } from "@/components/admin/ui";

type UserRow = {
	id: string;
	email: string;
	name: string;
	roleId: string | null;
	roleName: string | null;
	locked: boolean;
	lockedReason: string | null;
	mfaEnabled: boolean;
	mustChangePassword: boolean;
	lastLoginAt: string | null;
	createdAt: string | null;
};
type RoleOption = { id: string; name: string };
type Result = { rows: UserRow[]; page: number; pageSize: number; total: number };

export default function AccountsPage() {
	const { can } = useAdmin();
	const [q, setQ] = useState("");
	const [search, setSearch] = useState("");
	const searchRef = useRef("");
	const [roleId, setRoleId] = useState("");
	const [status, setStatus] = useState("");
	const [page, setPage] = useState(1);
	const [roles, setRoles] = useState<RoleOption[] | null>(null);
	const [loaded, setLoaded] = useState<{ key: string; result: Result | null; error: string } | null>(null);
	const [attempt, setAttempt] = useState(0);
	const params = new URLSearchParams();
	if (search) params.set("q", search);
	if (roleId) params.set("roleId", roleId);
	if (status) params.set("status", status);
	params.set("page", String(page));
	const query = params.toString();
	const key = `${query}#${attempt}`;
	const current = loaded?.key === key;
	const loading = !current;
	const error = current ? loaded.error : "";
	const result = loaded?.result ?? null;

	// The role filter needs the list of roles, which is the Vai trò module's: without its "view" right the filter is simply left out.
	const canRoles = can("roles", "view");
	useEffect(() => {
		if (!canRoles) return;
		let alive = true;
		api<{ roles: RoleOption[] }>("GET", "roles")
			.then((data) => alive && setRoles(data.roles))
			.catch(() => alive && setRoles(null));
		return () => {
			alive = false;
		};
	}, [canRoles]);

	useEffect(() => {
		const timer = setTimeout(() => {
			const next = q.trim();
			if (next === searchRef.current) return;
			searchRef.current = next;
			setSearch(next);
			setPage(1);
		}, 300);
		return () => clearTimeout(timer);
	}, [q]);

	useEffect(() => {
		let alive = true;
		apiList<UserRow>(`users?${query}`)
			.then((data) => alive && setLoaded({ key, result: data, error: "" }))
			.catch((caught) => alive && setLoaded((old) => ({ key, result: old?.result ?? null, error: errorText(caught) })));
		return () => {
			alive = false;
		};
	}, [query, key]);

	const retry = useCallback(() => setAttempt((n) => n + 1), []);

	return (
		<>
			<PageHeader title="Tài khoản">
				{can("users", "create") ? (
					<Link href="/quan-tri/tai-khoan/moi" className="tq-btn tq-btn--primary">
						Thêm tài khoản
					</Link>
				) : null}
			</PageHeader>

			<div className="tq-toolbar" role="search">
				<TextField label="Tìm kiếm" type="search" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Họ tên hoặc email" />
				{roles ? (
					<SelectField
						label="Vai trò"
						name="roleId"
						value={roleId}
						onChange={(e) => {
							setRoleId(e.target.value);
							setPage(1);
						}}
					>
						<option value="">Tất cả</option>
						{roles.map((role) => (
							<option key={role.id} value={role.id}>
								{role.name}
							</option>
						))}
					</SelectField>
				) : null}
				<SelectField
					label="Trạng thái"
					name="status"
					value={status}
					onChange={(e) => {
						setStatus(e.target.value);
						setPage(1);
					}}
				>
					<option value="">Tất cả</option>
					<option value="active">Đang hoạt động</option>
					<option value="locked">Đã khóa</option>
				</SelectField>
			</div>

			{error ? (
				<>
					<Alert kind="error">{error}</Alert>
					<Button variant="secondary" onClick={retry}>
						Thử lại
					</Button>
				</>
			) : loading && !result ? (
				<Loading />
			) : result && result.rows.length === 0 ? (
				<EmptyState>{search || roleId || status ? "Không có tài khoản nào khớp bộ lọc." : "Chưa có tài khoản nào."}</EmptyState>
			) : result ? (
				<>
					<div className="tq-table-wrap" aria-busy={loading || undefined}>
						<table className="tq-table">
							<caption className="tq-h2">Danh sách tài khoản ({result.total})</caption>
							<thead>
								<tr>
									<th scope="col">Họ tên và email</th>
									<th scope="col">Vai trò</th>
									<th scope="col">Trạng thái</th>
									<th scope="col">Đăng nhập gần nhất</th>
								</tr>
							</thead>
							<tbody>
								{result.rows.map((user) => (
									<tr key={user.id}>
										<td>
											<Link href={`/quan-tri/tai-khoan/${encodeURIComponent(user.id)}`}>
												<strong>{user.name}</strong>
											</Link>
											<br />
											<span className="tq-muted">{user.email}</span>
										</td>
										<td>{user.roleName ?? "—"}</td>
										<td>
											{user.locked ? <Badge tone="danger">Đã khóa</Badge> : null} {user.mfaEnabled ? <Badge tone="ok">2FA</Badge> : null}{" "}
											{user.mustChangePassword ? <Badge tone="warn">Chờ đổi mật khẩu</Badge> : null}
										</td>
										<td>{when(user.lastLoginAt)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<Pager page={result.page} pageSize={result.pageSize} total={result.total} onPage={setPage} />
				</>
			) : null}
		</>
	);
}

"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { Alert, Button, errorText, fieldErrors, Loading, PageHeader, SelectField, TextField } from "@/components/admin/ui";

type RoleOption = { id: string; name: string; assignable?: boolean };
type Created = { user: { id: string; email: string; name: string }; temporaryPassword: string };

export default function NewAccountPage() {
	const { can } = useAdmin();
	const [roles, setRoles] = useState<RoleOption[] | null>(null);
	const [rolesError, setRolesError] = useState("");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [roleId, setRoleId] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const [created, setCreated] = useState<Created | null>(null);

	// Choosing a role needs the list of roles (the Vai trò module's "view" right).
	const canRoles = can("roles", "view");
	useEffect(() => {
		if (!canRoles) return;
		let alive = true;
		api<{ roles: RoleOption[] }>("GET", "roles")
			.then((data) => alive && setRoles(data.roles))
			.catch((caught) => alive && setRolesError(errorText(caught)));
		return () => {
			alive = false;
		};
	}, [canRoles]);

	// the temporary password must not outlive this page
	useEffect(() => () => setCreated(null), []);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setFields({});
		try {
			const result = await api<Created>("POST", "users", { name, email, roleId });
			setCreated(result);
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		}
		setBusy(false);
	}

	function another() {
		setCreated(null);
		setName("");
		setEmail("");
		setRoleId("");
	}

	const back = (
		<Link href="/quan-tri/tai-khoan" className="tq-back">
			← Danh sách tài khoản
		</Link>
	);

	if (!can("users", "create")) {
		return (
			<>
				<PageHeader title="Thêm tài khoản" back={back} />
				<Alert kind="error">Bạn không có quyền tạo tài khoản.</Alert>
			</>
		);
	}

	if (created) {
		return (
			<>
				<PageHeader title="Thêm tài khoản" back={back} />
				<Alert kind="success">
					<p>
						Đã tạo tài khoản <strong>{created.user.email}</strong>. Mật khẩu tạm thời:
					</p>
					<p>
						<code className="tq-code">{created.temporaryPassword}</code>
					</p>
					<p>Mật khẩu này chỉ hiện một lần. Hãy gửi cho người dùng qua kênh an toàn; họ sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.</p>
				</Alert>
				<div className="tq-actions">
					<Link href={`/quan-tri/tai-khoan/${encodeURIComponent(created.user.id)}`} className="tq-btn tq-btn--primary">
						Mở tài khoản
					</Link>
					<Button variant="secondary" onClick={another}>
						Thêm tài khoản khác
					</Button>
				</div>
			</>
		);
	}

	return (
		<>
			<PageHeader title="Thêm tài khoản" back={back} />
			<section className="tq-panel">
				{!canRoles ? <Alert kind="warning">Bạn không có quyền xem danh sách vai trò nên chưa chọn được vai trò cho tài khoản mới. Hãy nhờ quản trị viên cấp quyền xem mục Vai trò và quyền.</Alert> : null}
				{rolesError ? <Alert kind="error">{`Không tải được danh sách vai trò: ${rolesError}`}</Alert> : null}
				{error ? <Alert kind="error">{error}</Alert> : null}
				{!canRoles ? null : !roles && !rolesError ? (
					<Loading />
				) : (
					<form onSubmit={submit} noValidate>
						<TextField label="Họ tên" name="name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} error={fields.name} required />
						<TextField label="Email" type="email" name="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} required />
						<SelectField label="Vai trò" name="roleId" value={roleId} onChange={(e) => setRoleId(e.target.value)} error={fields.roleId} required>
							<option value="">Chọn vai trò</option>
							{(roles ?? []).filter((role) => role.assignable !== false).map((role) => (
								<option key={role.id} value={role.id}>
									{role.name}
								</option>
							))}
						</SelectField>
						<Button type="submit" busy={busy} disabled={!roles}>
							Tạo tài khoản
						</Button>
					</form>
				)}
			</section>
		</>
	);
}

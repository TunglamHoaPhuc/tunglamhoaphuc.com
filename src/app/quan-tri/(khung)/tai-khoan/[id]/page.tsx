"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { Alert, Badge, Button, errorText, fieldErrors, Loading, PageHeader, SelectField, TextField, when } from "@/components/admin/ui";

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
type SessionRow = { id: string; createdAt: string | null; lastUsedAt: string | null; ip: string | null; userAgent: string | null; current: boolean };
type RoleOption = { id: string; name: string };

const shorten = (text: string | null, max = 60) => (!text ? "—" : text.length > max ? `${text.slice(0, max)}…` : text);

export default function AccountDetailPage() {
	const params = useParams<{ id: string }>();
	const id = Array.isArray(params.id) ? params.id[0] : params.id;
	const router = useRouter();
	const { me, can } = useAdmin();
	const mounted = useRef(true);
	const [user, setUser] = useState<UserRow | null>(null);
	const [sessions, setSessions] = useState<SessionRow[] | null>(null);
	const [roles, setRoles] = useState<RoleOption[] | null>(null);
	const [loadError, setLoadError] = useState("");
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState("");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [roleId, setRoleId] = useState("");
	const [reason, setReason] = useState("");
	const [confirmDelete, setConfirmDelete] = useState(false);

	const isSelf = id === me.user.id;
	const canUpdate = can("users", "update");
	const canDelete = can("users", "delete");
	const isSuper = me.user.role === "Super Admin";

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const load = useCallback(async () => {
		try {
			const row = await api<UserRow>("GET", `users/${encodeURIComponent(id)}`);
			if (!mounted.current) return;
			setUser(row);
			setName(row.name);
			setEmail(row.email);
			setRoleId(row.roleId ?? "");
			setLoadError("");
		} catch (caught) {
			if (mounted.current) setLoadError(errorText(caught));
			return;
		}
		if (canUpdate) {
			try {
				const data = await api<{ sessions: SessionRow[] }>("GET", `users/${encodeURIComponent(id)}/sessions`);
				if (mounted.current) setSessions(data.sessions);
			} catch {
				if (mounted.current) setSessions([]);
			}
		}
	}, [id, canUpdate]);

	useEffect(() => {
		queueMicrotask(() => void load());
	}, [load]);

	useEffect(() => {
		let alive = true;
		api<{ roles: RoleOption[] }>("GET", "roles")
			.then((data) => alive && setRoles(data.roles))
			.catch((caught) => {
				// 403 means no right to list roles: the role is then shown read-only
				if (alive && !(caught instanceof ApiClientError && caught.status === 403)) setRoles(null);
			});
		return () => {
			alive = false;
		};
	}, []);

	async function run(key: string, action: () => Promise<string | void>) {
		setBusy(key);
		setError("");
		setFields({});
		setNotice("");
		try {
			const message = await action();
			if (!mounted.current) return;
			if (message) setNotice(message);
			if (key === "delete") return; // the account is gone: the page is already leaving
			await load();
		} catch (caught) {
			if (mounted.current) {
				setError(errorText(caught));
				setFields(fieldErrors(caught));
			}
		}
		if (mounted.current) setBusy("");
	}

	function save(event: FormEvent) {
		event.preventDefault();
		if (!user) return;
		const body: { name?: string; email?: string; roleId?: string } = {};
		if (name !== user.name) body.name = name;
		if (!isSelf && email !== user.email) body.email = email;
		if (!isSelf && roles && roleId && roleId !== (user.roleId ?? "")) body.roleId = roleId;
		if (Object.keys(body).length === 0) {
			setNotice("");
			setError("Chưa có thay đổi nào để lưu.");
			return;
		}
		void run("save", async () => {
			await api("PATCH", `users/${encodeURIComponent(id)}`, body);
			return "Đã lưu thông tin tài khoản.";
		});
	}

	const path = `users/${encodeURIComponent(id)}`;
	const back = (
		<Link href="/quan-tri/tai-khoan" className="tq-back">
			← Danh sách tài khoản
		</Link>
	);

	if (loadError) {
		return (
			<>
				<PageHeader title="Tài khoản" back={back} />
				<Alert kind="error">{loadError}</Alert>
				<Button variant="secondary" onClick={() => void load()}>
					Thử lại
				</Button>
			</>
		);
	}
	if (!user) {
		return (
			<>
				<PageHeader title="Tài khoản" back={back} />
				<Loading />
			</>
		);
	}

	return (
		<>
			<PageHeader title={user.name} back={back}>
				{user.locked ? <Badge tone="danger">Đã khóa</Badge> : null}
				{user.mfaEnabled ? <Badge tone="ok">2FA</Badge> : null}
				{user.mustChangePassword ? <Badge tone="warn">Chờ đổi mật khẩu</Badge> : null}
			</PageHeader>

			{notice ? <Alert kind="success">{notice}</Alert> : null}
			{error ? <Alert kind="error">{error}</Alert> : null}

			<div className="tq-grid">
				<section className="tq-panel" aria-labelledby="tk-info">
					<h2 className="tq-h2" id="tk-info">
						Thông tin
					</h2>
					<dl className="tq-kv">
						<dt>Email</dt>
						<dd>{user.email}</dd>
						<dt>Vai trò</dt>
						<dd>{user.roleName ?? "—"}</dd>
						<dt>Xác thực hai bước</dt>
						<dd>{user.mfaEnabled ? "Đã bật" : "Chưa bật"}</dd>
						<dt>Đăng nhập gần nhất</dt>
						<dd>{when(user.lastLoginAt)}</dd>
						<dt>Ngày tạo</dt>
						<dd>{when(user.createdAt)}</dd>
						<dt>Trạng thái</dt>
						<dd>{user.locked ? `Đã khóa${user.lockedReason ? `: ${user.lockedReason}` : ""}` : "Đang hoạt động"}</dd>
					</dl>
					{canUpdate ? (
						<form onSubmit={save} noValidate>
							<TextField label="Họ tên" name="name" value={name} onChange={(e) => setName(e.target.value)} error={fields.name} required />
							{isSelf ? (
								<p className="tq-muted">Bạn không thể tự đổi email hoặc vai trò của chính mình.</p>
							) : (
								<>
									<TextField label="Email" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} required />
									{roles ? (
										<SelectField label="Vai trò" name="roleId" value={roleId} onChange={(e) => setRoleId(e.target.value)} error={fields.roleId}>
											{user.roleId ? null : <option value="">Chưa có vai trò</option>}
											{roles.map((role) => (
												<option key={role.id} value={role.id}>
													{role.name}
												</option>
											))}
										</SelectField>
									) : (
										<p className="tq-muted">Vai trò hiện tại: {user.roleName ?? "—"} (bạn không có quyền xem danh sách vai trò để đổi).</p>
									)}
								</>
							)}
							<Button type="submit" busy={busy === "save"} disabled={!!busy}>
								Lưu thay đổi
							</Button>
						</form>
					) : null}
				</section>

				{canUpdate ? (
					<section className="tq-panel" aria-labelledby="tk-actions">
						<h2 className="tq-h2" id="tk-actions">
							Hành động
						</h2>
						{!isSelf ? (
							user.locked ? (
								<p>
									<Button
										variant="secondary"
										busy={busy === "unlock"}
										disabled={!!busy}
										onClick={() =>
											void run("unlock", async () => {
												await api("POST", `${path}/unlock`, {});
												return "Đã mở khóa tài khoản.";
											})
										}
									>
										Mở khóa
									</Button>
								</p>
							) : (
								<div>
									<TextField label="Lý do khóa (không bắt buộc)" name="reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
									<Button
										variant="secondary"
										busy={busy === "lock"}
										disabled={!!busy}
										onClick={() =>
											void run("lock", async () => {
												await api("POST", `${path}/lock`, { reason });
												setReason("");
												return "Đã khóa tài khoản. Các phiên đăng nhập của họ đã kết thúc.";
											})
										}
									>
										Khóa tài khoản
									</Button>
								</div>
							)
						) : null}
						<div className="tq-actions">
							<Button
								variant="secondary"
								busy={busy === "force"}
								disabled={!!busy}
								onClick={() =>
									void run("force", async () => {
										await api("POST", `${path}/force-password-change`, {});
										return "Người dùng sẽ phải đổi mật khẩu ở lần đăng nhập tới.";
									})
								}
							>
								Yêu cầu đổi mật khẩu
							</Button>
							{isSuper && user.mfaEnabled ? (
								<Button
									variant="secondary"
									busy={busy === "reset2fa"}
									disabled={!!busy}
									onClick={() =>
										void run("reset2fa", async () => {
											await api("POST", `${path}/reset-2fa`, {});
											return "Đã gỡ xác thực hai bước.";
										})
									}
								>
									Gỡ xác thực hai bước
								</Button>
							) : null}
							<Button
								variant="secondary"
								busy={busy === "signout"}
								disabled={!!busy}
								onClick={() =>
									void run("signout", async () => {
										const data = await api<{ ended: number }>("DELETE", `${path}/sessions`);
										return `Đã đăng xuất ${data?.ended ?? 0} phiên đăng nhập.`;
									})
								}
							>
								Đăng xuất mọi thiết bị
							</Button>
						</div>
					</section>
				) : null}
			</div>

			{canUpdate ? (
				<section className="tq-panel" aria-labelledby="tk-sessions">
					<h2 className="tq-h2" id="tk-sessions">
						Phiên đăng nhập
					</h2>
					{!sessions ? (
						<Loading />
					) : sessions.length === 0 ? (
						<p className="tq-muted">Không có phiên đăng nhập nào đang mở.</p>
					) : (
						<div className="tq-table-wrap">
							<table className="tq-table">
								<caption className="tq-muted">Các phiên đăng nhập đang mở của tài khoản này</caption>
								<thead>
									<tr>
										<th scope="col">Bắt đầu</th>
										<th scope="col">Dùng lần cuối</th>
										<th scope="col">Địa chỉ IP</th>
										<th scope="col">Thiết bị</th>
									</tr>
								</thead>
								<tbody>
									{sessions.map((session) => (
										<tr key={session.id}>
											<td>
												{when(session.createdAt)} {session.current ? <Badge tone="ok">Phiên này</Badge> : null}
											</td>
											<td>{when(session.lastUsedAt)}</td>
											<td>{session.ip ?? "—"}</td>
											<td title={session.userAgent ?? undefined}>{shorten(session.userAgent)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			) : null}

			{canDelete && !isSelf ? (
				<section className="tq-panel" aria-labelledby="tk-delete">
					<h2 className="tq-h2" id="tk-delete">
						Xóa tài khoản
					</h2>
					{confirmDelete ? (
						<div>
							<Alert kind="warning">Xóa tài khoản {user.name}? Tài khoản sẽ vào thùng rác và không đăng nhập được nữa.</Alert>
							<div className="tq-actions">
								<Button
									variant="danger"
									busy={busy === "delete"}
									disabled={!!busy}
									onClick={() =>
										void run("delete", async () => {
											await api("DELETE", path);
											router.replace("/quan-tri/tai-khoan");
										})
									}
								>
									Xóa
								</Button>
								<Button variant="secondary" disabled={!!busy} onClick={() => setConfirmDelete(false)}>
									Hủy
								</Button>
							</div>
						</div>
					) : (
						<Button variant="danger" disabled={!!busy} onClick={() => setConfirmDelete(true)}>
							Xóa tài khoản
						</Button>
					)}
				</section>
			) : null}
		</>
	);
}

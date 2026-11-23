"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { mayGrant } from "@/components/admin/ownScope";
import { PermissionMatrix, type MatrixModule } from "@/components/admin/PermissionMatrix";
import { Alert, Badge, Button, errorText, fieldErrors, Loading, PageHeader, TextArea, TextField } from "@/components/admin/ui";

type Catalog = { modules: MatrixModule[]; actions: string[] };
type Role = { id: string; name: string; description: string; isSystem: boolean; users: number; permissions?: string[] };

const SUPER_ADMIN_ID = "role-super-admin";

export default function RoleDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const { me, can } = useAdmin();
	const [role, setRole] = useState<Role | null>(null);
	const [catalog, setCatalog] = useState<Catalog | null>(null);
	const [loadError, setLoadError] = useState("");
	const [attempt, setAttempt] = useState(0);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [permissions, setPermissions] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const [saved, setSaved] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState("");
	const confirmRef = useRef<HTMLDivElement>(null);
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const mayView = can("roles", "view");

	useEffect(() => {
		if (!mayView) return;
		let active = true;
		Promise.all([api<Role>("GET", `roles/${encodeURIComponent(id)}`), api<Catalog>("GET", "permissions")])
			.then(([loaded, cat]) => {
				if (!active) return;
				setRole(loaded);
				setName(loaded.name);
				setDescription(loaded.description);
				setPermissions(loaded.permissions ?? []);
				setCatalog(cat);
			})
			.catch((caught: unknown) => {
				if (active) setLoadError(errorText(caught));
			});
		return () => {
			active = false;
		};
	}, [id, mayView, attempt]);

	useEffect(() => {
		if (confirming) confirmRef.current?.focus();
	}, [confirming]);

	const back = <Link href="/quan-tri/vai-tro" className="tq-back">← Vai trò và quyền</Link>;

	if (!mayView) {
		return (
			<>
				<PageHeader title="Vai trò" back={back} />
				<Alert kind="warning">Bạn không có quyền xem vai trò.</Alert>
			</>
		);
	}
	if (loadError) {
		return (
			<>
				<PageHeader title="Vai trò" back={back} />
				<Alert kind="error">{loadError}</Alert>
				<Button
					variant="secondary"
					onClick={() => {
						setLoadError("");
						setAttempt((n) => n + 1);
					}}
				>
					Thử lại
				</Button>
			</>
		);
	}
	if (!role || !catalog) {
		return (
			<>
				<PageHeader title="Vai trò" back={back} />
				<Loading />
			</>
		);
	}

	const isSuper = role.id === SUPER_ADMIN_ID;
	const isOwn = role.id === me.user.roleId;
	const mayUpdate = can("roles", "update");
	const editable = mayUpdate && !isSuper && !isOwn;
	const mayDelete = can("roles", "delete") && !role.isSystem;

	async function save(event: FormEvent) {
		event.preventDefault();
		if (!role) return;
		setBusy(true);
		setError("");
		setFields({});
		setSaved(false);
		try {
			const body = role.isSystem ? { description, permissions } : { name, description, permissions };
			const updated = await api<Role>("PATCH", `roles/${encodeURIComponent(role.id)}`, body);
			if (!mounted.current) return;
			setRole(updated);
			setName(updated.name);
			setDescription(updated.description);
			setPermissions(updated.permissions ?? []);
			setSaved(true);
		} catch (caught) {
			if (!mounted.current) return;
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		}
		if (mounted.current) setBusy(false);
	}

	async function remove() {
		if (!role) return;
		setDeleting(true);
		setDeleteError("");
		try {
			await api("DELETE", `roles/${encodeURIComponent(role.id)}`);
			if (mounted.current) router.push("/quan-tri/vai-tro");
		} catch (caught) {
			if (!mounted.current) return;
			setDeleteError(errorText(caught));
			setDeleting(false);
		}
	}

	return (
		<>
			<PageHeader title={role.name} back={back}>
				{role.isSystem ? <Badge tone="ok">Vai trò mẫu</Badge> : null}
				<span className="tq-muted">{role.users} tài khoản</span>
			</PageHeader>

			{isSuper ? (
				<Alert kind="info">Vai trò Super Admin có toàn quyền và không thể chỉnh sửa.</Alert>
			) : isOwn ? (
				<Alert kind="info">Đây là vai trò của chính bạn nên bạn không thể sửa. Hãy nhờ một Super Admin khác thay đổi.</Alert>
			) : !mayUpdate ? (
				<Alert kind="info">Bạn chỉ có quyền xem vai trò này, không có quyền sửa.</Alert>
			) : role.isSystem ? (
				<Alert kind="info">Đây là vai trò mẫu: bạn đổi được mô tả và quyền, không đổi được tên và không xóa được.</Alert>
			) : null}

			<form onSubmit={save} noValidate>
				{saved ? <Alert kind="success">Đã lưu vai trò.</Alert> : null}
				{error ? <Alert kind="error">{error}</Alert> : null}
				<div className="tq-panel">
					<TextField label="Tên vai trò" name="name" value={name} onChange={(e) => setName(e.target.value)} error={fields.name} maxLength={80} disabled={!editable || role.isSystem} required />
					<TextArea label="Mô tả" name="description" value={description} onChange={(e) => setDescription(e.target.value)} error={fields.description} disabled={!editable} />
				</div>
				<section className="tq-panel" aria-labelledby="matrix-title">
					<h2 id="matrix-title" className="tq-h2">Quyền</h2>
					<p className="tq-hint">“Của mình” nghĩa là chỉ áp dụng cho nội dung do chính người đó tạo.{editable ? " Bạn chỉ cấp được những quyền bạn đang có." : ""}</p>
					{fields.permissions ? <Alert kind="error">{fields.permissions}</Alert> : null}
					<PermissionMatrix
						modules={catalog.modules}
						actions={catalog.actions}
						value={permissions}
						onChange={(next) => {
							setSaved(false);
							setPermissions(next);
						}}
						readOnly={!editable}
						canGrant={(m, a, wanted) => mayGrant(me.permissions, m, a, wanted)}
					/>
				</section>
				{editable ? (
					<div className="tq-actions">
						<Button type="submit" busy={busy}>Lưu</Button>
					</div>
				) : null}
			</form>

			{mayDelete ? (
				<section className="tq-panel" aria-labelledby="danger-title" style={{ marginTop: 24 }}>
					<h2 id="danger-title" className="tq-h2">Xóa vai trò</h2>
					{role.users > 0 ? (
						<>
							<p className="tq-muted">Còn {role.users} tài khoản đang dùng vai trò này. Hãy chuyển họ sang vai trò khác trước khi xóa.</p>
							<Button variant="danger" disabled>Xóa vai trò</Button>
						</>
					) : confirming ? (
						<div ref={confirmRef} tabIndex={-1}>
							<Alert kind="warning">Xóa vai trò “{role.name}”? Việc này không hoàn tác được trên màn hình này.</Alert>
							{deleteError ? <Alert kind="error">{deleteError}</Alert> : null}
							<div className="tq-actions">
								<Button variant="danger" busy={deleting} onClick={() => void remove()}>Xác nhận xóa</Button>
								<Button
									variant="secondary"
									disabled={deleting}
									onClick={() => {
										setConfirming(false);
										setDeleteError("");
									}}
								>
									Hủy
								</Button>
							</div>
						</div>
					) : (
						<>
							<p className="tq-muted">Vai trò chưa có tài khoản nào dùng nên có thể xóa.</p>
							<Button variant="danger" onClick={() => setConfirming(true)}>Xóa vai trò</Button>
						</>
					)}
				</section>
			) : null}
		</>
	);
}

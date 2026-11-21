"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/components/admin/api";
import { useAdmin } from "@/components/admin/AdminProvider";
import { PermissionMatrix, type MatrixModule } from "@/components/admin/PermissionMatrix";
import { Alert, Button, errorText, fieldErrors, Loading, PageHeader, TextArea, TextField } from "@/components/admin/ui";

type Catalog = { modules: MatrixModule[]; actions: string[] };
type RoleRow = { id: string };

export default function NewRolePage() {
	const router = useRouter();
	const { can } = useAdmin();
	const mayCreate = can("roles", "create");
	const [catalog, setCatalog] = useState<Catalog | null>(null);
	const [loadError, setLoadError] = useState("");
	const [attempt, setAttempt] = useState(0);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [permissions, setPermissions] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	useEffect(() => {
		if (!mayCreate) return;
		let active = true;
		api<Catalog>("GET", "permissions")
			.then((data) => {
				if (active) setCatalog(data);
			})
			.catch((caught: unknown) => {
				if (active) setLoadError(errorText(caught));
			});
		return () => {
			active = false;
		};
	}, [mayCreate, attempt]);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setFields({});
		try {
			const role = await api<RoleRow>("POST", "roles", { name, description, permissions });
			if (mounted.current) router.push(`/quan-tri/vai-tro/${encodeURIComponent(role.id)}`);
		} catch (caught) {
			if (!mounted.current) return;
			setError(errorText(caught));
			setFields(fieldErrors(caught));
			setBusy(false);
		}
	}

	const back = <Link href="/quan-tri/vai-tro" className="tq-back">← Vai trò và quyền</Link>;

	if (!mayCreate) {
		return (
			<>
				<PageHeader title="Thêm vai trò" back={back} />
				<Alert kind="warning">Bạn không có quyền thêm vai trò.</Alert>
			</>
		);
	}

	return (
		<>
			<PageHeader title="Thêm vai trò" back={back} />
			{loadError ? (
				<>
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
			) : !catalog ? (
				<Loading />
			) : (
				<form onSubmit={submit} noValidate>
					{error ? <Alert kind="error">{error}</Alert> : null}
					<div className="tq-panel">
						<TextField label="Tên vai trò" name="name" value={name} onChange={(e) => setName(e.target.value)} error={fields.name} maxLength={80} required autoFocus />
						<TextArea label="Mô tả" name="description" value={description} onChange={(e) => setDescription(e.target.value)} error={fields.description} />
					</div>
					<section className="tq-panel" aria-labelledby="matrix-title">
						<h2 id="matrix-title" className="tq-h2">Quyền</h2>
						<p className="tq-hint">“Của mình” nghĩa là chỉ áp dụng cho nội dung do chính người đó tạo. Bạn chỉ cấp được những quyền bạn đang có.</p>
						{fields.permissions ? <Alert kind="error">{fields.permissions}</Alert> : null}
						<PermissionMatrix modules={catalog.modules} actions={catalog.actions} value={permissions} onChange={setPermissions} canGrant={(m, a) => can(m, a)} />
					</section>
					<div className="tq-actions">
						<Button type="submit" busy={busy}>Tạo vai trò</Button>
						<Link href="/quan-tri/vai-tro" className="tq-btn tq-btn--secondary">Hủy</Link>
					</div>
				</form>
			)}
		</>
	);
}

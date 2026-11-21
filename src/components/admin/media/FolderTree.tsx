"use client";

import { useState, type FormEvent } from "react";
import { api } from "../api";
import { Alert, errorText, fieldErrors } from "../ui";
import { formatNumber, type Folder, type FolderList } from "./imageTools";

/** What is selected in the library: "" = every picture, "none" = pictures without a folder, otherwise a folder id. */
export type FolderChoice = string;

type Mode = { kind: "create"; parentId: string | null } | { kind: "rename"; id: string } | { kind: "delete"; id: string } | null;

const ALL_STYLE = { display: "flex", justifyContent: "space-between", gap: 8, width: "100%", textAlign: "left" as const };

export function FolderTree({
	list,
	total,
	selected,
	onSelect,
	onChanged,
	canCreate,
	canUpdate,
	canDelete,
}: {
	list: FolderList | null;
	total: number | null;
	selected: FolderChoice;
	onSelect: (choice: FolderChoice) => void;
	onChanged: () => void;
	canCreate: boolean;
	canUpdate: boolean;
	canDelete: boolean;
}) {
	const [mode, setMode] = useState<Mode>(null);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fieldError, setFieldError] = useState("");

	const folders = list?.folders ?? [];
	const current = folders.find((folder) => folder.id === selected) ?? null;

	function open(next: Mode, initialName = "") {
		setMode(next);
		setName(initialName);
		setError("");
		setFieldError("");
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!mode || mode.kind === "delete") return;
		setBusy(true);
		setError("");
		setFieldError("");
		try {
			if (mode.kind === "create") {
				const created = await api<Folder>("POST", "media/folders", { name: name.trim(), parentId: mode.parentId });
				onChanged();
				onSelect(created.id);
			} else {
				await api("PATCH", `media/folders/${encodeURIComponent(mode.id)}`, { name: name.trim() });
				onChanged();
			}
			setMode(null);
		} catch (caught) {
			setError(errorText(caught));
			setFieldError(fieldErrors(caught).name ?? "");
		} finally {
			setBusy(false);
		}
	}

	async function remove(folder: Folder) {
		setBusy(true);
		setError("");
		try {
			await api("DELETE", `media/folders/${encodeURIComponent(folder.id)}`);
			if (selected === folder.id) onSelect("");
			onChanged();
			setMode(null);
		} catch (caught) {
			setError(errorText(caught));
		} finally {
			setBusy(false);
		}
	}

	const children = (parentId: string | null) => folders.filter((folder) => (folder.parentId ?? null) === parentId);

	function node(folder: Folder, depth: number) {
		const active = selected === folder.id;
		return (
			<li key={folder.id}>
				<button
					type="button"
					className={`tq-btn tq-btn--small ${active ? "" : "tq-btn--secondary"}`}
					style={{ ...ALL_STYLE, marginLeft: depth * 14, width: `calc(100% - ${depth * 14}px)` }}
					aria-current={active ? "true" : undefined}
					onClick={() => onSelect(folder.id)}
				>
					<span>{folder.name}</span>
					<span>{formatNumber(folder.count)}</span>
				</button>
				{children(folder.id).length ? <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0, display: "grid", gap: 4 }}>{children(folder.id).map((child) => node(child, depth + 1))}</ul> : null}
			</li>
		);
	}

	// A folder that lost its parent would otherwise vanish from the tree: show it at the top level.
	const knownIds = new Set(folders.map((folder) => folder.id));
	const roots = folders.filter((folder) => !folder.parentId || !knownIds.has(folder.parentId));

	const form =
		mode && mode.kind !== "delete" ? (
			<form onSubmit={submit} noValidate style={{ display: "grid", gap: 6, marginTop: 8 }}>
				<div className="tq-field">
					<label htmlFor="folder-name" className="tq-label">
						{mode.kind === "create" ? (mode.parentId ? `Tên thư mục con của "${folders.find((f) => f.id === mode.parentId)?.name ?? ""}"` : "Tên thư mục mới") : "Tên mới của thư mục"}
					</label>
					<input id="folder-name" className="tq-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={fieldError ? true : undefined} required autoFocus />
					{fieldError ? <p className="tq-field-error">{fieldError}</p> : null}
				</div>
				<div className="tq-actions">
					<button type="submit" className="tq-btn tq-btn--small" disabled={busy || !name.trim()}>
						{busy ? "Đang lưu…" : "Lưu"}
					</button>
					<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" disabled={busy} onClick={() => setMode(null)}>
						Hủy
					</button>
				</div>
			</form>
		) : null;

	return (
		<nav aria-label="Thư mục ảnh">
			<h2 className="tq-h2">Thư mục</h2>
			<ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
				<li>
					<button type="button" className={`tq-btn tq-btn--small ${selected === "" ? "" : "tq-btn--secondary"}`} style={ALL_STYLE} aria-current={selected === "" ? "true" : undefined} onClick={() => onSelect("")}>
						<span>Tất cả</span>
						<span>{total == null ? "" : formatNumber(total)}</span>
					</button>
				</li>
				<li>
					<button type="button" className={`tq-btn tq-btn--small ${selected === "none" ? "" : "tq-btn--secondary"}`} style={ALL_STYLE} aria-current={selected === "none" ? "true" : undefined} onClick={() => onSelect("none")}>
						<span>Chưa phân thư mục</span>
						<span>{list ? formatNumber(list.noFolder) : ""}</span>
					</button>
				</li>
				{roots.map((folder) => node(folder, 0))}
			</ul>

			{error ? <Alert kind="error">{error}</Alert> : null}

			{canCreate || canUpdate || canDelete ? (
				<div style={{ marginTop: 10 }}>
					<div className="tq-actions">
						{canCreate ? (
							<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => open({ kind: "create", parentId: null })}>
								Thêm thư mục
							</button>
						) : null}
					</div>
					{current ? (
						<div style={{ marginTop: 8 }}>
							<p className="tq-muted" style={{ margin: "0 0 4px" }}>
								Đang chọn: <strong>{current.name}</strong>
							</p>
							<div className="tq-actions">
								{canCreate ? (
									<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => open({ kind: "create", parentId: current.id })}>
										Thêm thư mục con
									</button>
								) : null}
								{canUpdate ? (
									<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" onClick={() => open({ kind: "rename", id: current.id }, current.name)}>
										Đổi tên
									</button>
								) : null}
								{canDelete ? (
									<button type="button" className="tq-btn tq-btn--danger tq-btn--small" onClick={() => open({ kind: "delete", id: current.id })}>
										Xóa thư mục
									</button>
								) : null}
							</div>
						</div>
					) : null}
					{form}
					{mode?.kind === "delete" && current && current.id === mode.id ? (
						<div style={{ marginTop: 8 }} role="group" aria-label="Xác nhận xóa thư mục">
							<p style={{ margin: "0 0 6px" }}>
								Xóa thư mục <strong>{current.name}</strong>? Chỉ xóa được khi thư mục trống (không có ảnh và không có thư mục con).
							</p>
							<div className="tq-actions">
								<button type="button" className="tq-btn tq-btn--danger tq-btn--small" disabled={busy} onClick={() => void remove(current)}>
									{busy ? "Đang xóa…" : "Xóa thư mục"}
								</button>
								<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" disabled={busy} onClick={() => setMode(null)}>
									Hủy
								</button>
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</nav>
	);
}

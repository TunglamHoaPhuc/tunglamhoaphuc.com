"use client";

import { useState } from "react";
import { api } from "../api";
import { useDebounced, useLoader } from "../media/imageTools";
import { Alert, Button, EmptyState, errorText, fieldErrors, SelectField, TextField } from "../ui";
import { IconChooser } from "./IconChooser";
import { NO_ICON, SECTION_LABELS, type CategoryRow, type IconValue, type MenuItemRow } from "./types";

export type MenuItemFormMode = { type: "create"; menuId: string } | { type: "edit"; row: MenuItemRow };

type Target = { type: "page" | "teaching_article" | "post"; id: string; title: string; path: string };
const TARGET_LABELS = { page: "Trang Giới thiệu", teaching_article: "Bài Tông chỉ tu học", post: "Bài viết" } as const;

/** Picks a page, a Tông chỉ article or a post by searching its title. */
function TargetPicker({ chosen, current, onChoose }: { chosen: Target | null; current: string; onChoose: (target: Target) => void }) {
	const [type, setType] = useState<Target["type"]>("page");
	const [q, setQ] = useState("");
	const search = useDebounced(q.trim(), 300);
	const results = useLoader(() => api<Target[]>("GET", `link-targets?type=${type}&q=${encodeURIComponent(search)}`), `${type}|${search}`);
	return (
		<div className="tq-panel" style={{ margin: "8px 0" }}>
			<p className="tq-muted" style={{ marginTop: 0 }}>
				Đang dẫn tới: <code>{chosen ? chosen.path : current || "chưa chọn"}</code>
			</p>
			<div className="tq-toolbar" role="search">
				<SelectField label="Loại" value={type} onChange={(e) => setType(e.target.value as Target["type"])}>
					{Object.entries(TARGET_LABELS).map(([value, label]) => (
						<option key={value} value={value}>{label}</option>
					))}
				</SelectField>
				<TextField label="Tìm theo tiêu đề" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
			</div>
			{results.error ? <Alert kind="error">{results.error}</Alert> : null}
			{results.data && results.data.length === 0 ? <EmptyState>Không có kết quả.</EmptyState> : null}
			<ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 220, overflowY: "auto" }}>
				{(results.data ?? []).map((target) => (
					<li key={target.id} style={{ marginBottom: 4 }}>
						<button type="button" className="tq-btn tq-btn--secondary tq-btn--small" aria-pressed={chosen?.id === target.id} onClick={() => onChoose(target)} style={{ width: "100%", textAlign: "left" }}>
							{target.title} <span className="tq-muted">{target.path}</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

/** Add or change one menu item: its name, where it leads (a category, a page or an address), icon, and whether it shows. */
export function MenuItemForm({ mode, categories, parents, onSaved, onCancel }: { mode: MenuItemFormMode; categories: CategoryRow[]; parents: MenuItemRow[]; onSaved: (row: MenuItemRow) => void; onCancel: () => void }) {
	const editing = mode.type === "edit" ? mode.row : null;
	const menuId = mode.type === "create" ? mode.menuId : mode.row.menuId;
	const [label, setLabel] = useState(editing?.label ?? "");
	const [linkType, setLinkType] = useState<"category" | "page" | "url">(editing?.linkType ?? "url");
	const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
	const [target, setTarget] = useState<Target | null>(null);
	const [href, setHref] = useState(editing && editing.linkType === "url" ? editing.href : "");
	const [openNewTab, setOpenNewTab] = useState(editing?.openNewTab ?? false);
	const [visible, setVisible] = useState(editing?.visible ?? true);
	const [parentId, setParentId] = useState("");
	const [icon, setIcon] = useState<IconValue>(editing ? { iconType: editing.iconType, iconName: editing.iconName, iconSvg: editing.iconSvg, iconMediaId: editing.iconMediaId, iconUrl: editing.iconUrl, iconColor: editing.iconColor } : NO_ICON);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});

	async function save() {
		setBusy(true);
		setError("");
		setFields({});
		const link =
			linkType === "category" ? { linkType, categoryId: categoryId || null } : linkType === "page" ? { linkType, ...(target ? { pageRef: { type: target.type, id: target.id } } : {}) } : { linkType, href };
		const body = { label, ...link, openNewTab, visible, ...icon };
		try {
			const saved = editing
				? await api<MenuItemRow>("PATCH", `menu-items/${encodeURIComponent(editing.id)}`, body)
				: await api<MenuItemRow>("POST", `menus/${menuId}/items`, { ...body, parentId: parentId || null });
			onSaved(saved);
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
			setBusy(false);
		}
	}

	const chosenCategory = categories.find((row) => row.id === categoryId);
	const destination = linkType === "category" ? (chosenCategory?.path ?? "") : linkType === "page" ? (target?.path ?? editing?.href ?? "") : href;

	return (
		<form
			className="tq-panel"
			aria-label={editing ? `Sửa mục ${editing.label}` : "Thêm mục menu"}
			onSubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			<h2 className="tq-h2">{editing ? `Sửa: ${editing.label}` : "Thêm mục menu"}</h2>
			{error ? <Alert kind="error">{error}</Alert> : null}
			<TextField label="Tên hiển thị" value={label} onChange={(e) => setLabel(e.target.value)} error={fields.label} required maxLength={120} />

			{mode.type === "create" ? (
				<SelectField label="Nằm trong mục" value={parentId} onChange={(e) => setParentId(e.target.value)} error={fields.parentId}>
					<option value="">Không (cấp cao nhất)</option>
					{parents.map((row) => (
						<option key={row.id} value={row.id}>{`${"— ".repeat(row.depth)}${row.label}`}</option>
					))}
				</SelectField>
			) : null}

			<fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
				<legend className="tq-label">Liên kết tới</legend>
				<div role="radiogroup" style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
					{(
						[
							["category", "Một chuyên mục"],
							["page", "Một trang hoặc bài viết"],
							["url", "Địa chỉ tự nhập"],
						] as const
					).map(([value, text]) => (
						<label key={value} className="tq-check" style={{ margin: 0 }}>
							<input type="radio" name="linkType" checked={linkType === value} onChange={() => setLinkType(value)} />
							<span>{text}</span>
						</label>
					))}
				</div>
			</fieldset>

			{linkType === "category" ? (
				<SelectField label="Chuyên mục" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} error={fields.categoryId} hint="Mục menu dẫn tới trang của chuyên mục và tự đổi theo nếu chuyên mục đổi địa chỉ.">
					<option value="">Chọn chuyên mục…</option>
					{categories.map((row) => (
						<option key={row.id} value={row.id}>{`${row.kind === "post" ? (SECTION_LABELS[row.section] ?? row.section) : row.kind} · ${"— ".repeat(row.depth)}${row.name}`}</option>
					))}
				</SelectField>
			) : null}
			{linkType === "page" ? (
				<>
					<TargetPicker chosen={target} current={editing?.linkType === "page" ? editing.href : ""} onChoose={setTarget} />
					{fields.pageRef ? <p className="tq-field-error">{fields.pageRef}</p> : null}
				</>
			) : null}
			{linkType === "url" ? (
				<TextField label="Địa chỉ" value={href} onChange={(e) => setHref(e.target.value)} error={fields.href} placeholder="/lien-he hoặc https://…" hint="Trang trong web bắt đầu bằng một dấu / (ví dụ /lien-he). Trang ngoài phải bắt đầu bằng https://." />
			) : null}
			{destination ? <p className="tq-muted">Mục này sẽ dẫn tới: <code>{destination}</code></p> : null}

			<label className="tq-check">
				<input type="checkbox" checked={openNewTab} onChange={(e) => setOpenNewTab(e.target.checked)} />
				<span>Mở trong tab mới</span>
			</label>
			<label className="tq-check">
				<input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
				<span>Hiện mục này trên trang (bỏ chọn để tạm ẩn)</span>
			</label>

			<IconChooser value={icon} onChange={setIcon} label={label} error={fields.iconType || fields.iconName || fields.iconSvg || fields.iconMediaId || fields.iconUrl || fields.iconColor} />

			<div className="tq-actions" style={{ marginTop: 16, display: "flex", gap: 10 }}>
				<Button type="submit" busy={busy}>{editing ? "Lưu thay đổi" : "Thêm mục"}</Button>
				<Button variant="secondary" onClick={onCancel} disabled={busy}>Hủy</Button>
			</div>
		</form>
	);
}

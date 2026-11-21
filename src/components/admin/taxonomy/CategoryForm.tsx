"use client";

import { useEffect, useState } from "react";
import { api } from "../api";
import { MediaPicker } from "../media/MediaPicker";
import { useDebounced } from "../media/imageTools";
import { Alert, Button, errorText, fieldErrors, SelectField, TextArea, TextField } from "../ui";
import { IconChooser } from "./IconChooser";
import { KIND_LABELS, NO_ICON, SECTION_LABELS, TEMPLATE_LABELS, type CategoryRow, type IconValue } from "./types";

export type CategoryFormMode = { type: "create"; kind: string; section: string; parentId: string | null } | { type: "edit"; row: CategoryRow };

type Slug = { slug: string; available: boolean; suggestion: string };

/** Add or change one category. Everything the API takes is here: name, address (slug), kind of page, icon, SEO. */
export function CategoryForm({ mode, parents, onSaved, onCancel }: { mode: CategoryFormMode; parents: CategoryRow[]; onSaved: (row: CategoryRow) => void; onCancel: () => void }) {
	const editing = mode.type === "edit" ? mode.row : null;
	const kind = editing ? editing.kind : mode.type === "create" ? mode.kind : "post";
	const section = editing ? editing.section : mode.type === "create" ? mode.section : "";
	const [name, setName] = useState(editing?.name ?? "");
	const [slug, setSlug] = useState(editing?.slug ?? "");
	const [slugTouched, setSlugTouched] = useState(Boolean(editing));
	const [description, setDescription] = useState(editing?.description ?? "");
	const [template, setTemplate] = useState(editing?.template ?? "");
	const [visible, setVisible] = useState(editing?.visible ?? true);
	const [parentId, setParentId] = useState(mode.type === "create" ? (mode.parentId ?? "") : "");
	const [seoTitle, setSeoTitle] = useState(editing?.seoTitle ?? "");
	const [seoDescription, setSeoDescription] = useState(editing?.seoDescription ?? "");
	const [ogMediaId, setOgMediaId] = useState<string | null>(editing?.ogMediaId ?? null);
	const [ogPicking, setOgPicking] = useState(false);
	const [ogPreview, setOgPreview] = useState("");
	const [icon, setIcon] = useState<IconValue>(editing ? { iconType: editing.iconType, iconName: editing.iconName, iconSvg: editing.iconSvg, iconMediaId: editing.iconMediaId, iconUrl: editing.iconUrl, iconColor: editing.iconColor } : NO_ICON);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});

	// The address follows the name until the person types one.
	const wanted = slugTouched ? slug : name;
	const text = useDebounced(wanted.trim(), 350);
	const [check, setCheck] = useState<{ text: string; answer: Slug } | null>(null);
	useEffect(() => {
		if (!text) return;
		let alive = true;
		api<Slug>("GET", `slug?type=category&kind=${encodeURIComponent(kind)}&section=${encodeURIComponent(section)}&text=${encodeURIComponent(text)}${editing ? `&excludeId=${encodeURIComponent(editing.id)}` : ""}`)
			.then((answer) => alive && setCheck({ text, answer }))
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, [text, kind, section, editing]);
	const answer = check && check.text === text ? check.answer : null;
	const shownSlug = slugTouched ? slug : (answer?.slug ?? "");

	async function save() {
		setBusy(true);
		setError("");
		setFields({});
		const common = {
			name,
			slug: shownSlug || undefined,
			description,
			template,
			visible,
			seoTitle,
			seoDescription,
			ogMediaId,
			...icon,
		};
		try {
			const saved = editing
				? await api<CategoryRow>("PATCH", `categories/${encodeURIComponent(editing.id)}`, common)
				: await api<CategoryRow>("POST", "categories", { ...common, kind, section, parentId: parentId || null });
			onSaved(saved);
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
			setBusy(false);
		}
	}

	const group = `${KIND_LABELS[kind] ?? kind}${section ? ` · ${SECTION_LABELS[section] ?? section}` : ""}`;
	const slugChanged = Boolean(editing && shownSlug && shownSlug !== editing.slug);

	return (
		<form
			className="tq-panel"
			aria-label={editing ? `Sửa chuyên mục ${editing.name}` : "Thêm chuyên mục"}
			onSubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			<h2 className="tq-h2">{editing ? `Sửa: ${editing.name}` : "Thêm chuyên mục"}</h2>
			<p className="tq-muted">Nhóm: {group}</p>
			{error ? <Alert kind="error">{error}</Alert> : null}

			<TextField label="Tên chuyên mục" value={name} onChange={(e) => setName(e.target.value)} error={fields.name} required maxLength={120} />
			<TextField
				label="Địa chỉ (slug)"
				value={shownSlug}
				onChange={(e) => {
					setSlugTouched(true);
					setSlug(e.target.value);
				}}
				error={fields.slug}
				hint="Chữ không dấu, nối bằng dấu gạch ngang. Tự lấy từ tên; sửa nếu muốn."
			/>
			{answer && !answer.available ? (
				<Alert kind="warning">
					Địa chỉ &quot;{answer.slug}&quot; đã có chuyên mục khác dùng. Gợi ý: <strong>{answer.suggestion}</strong>{" "}
					<Button variant="link" onClick={() => { setSlugTouched(true); setSlug(answer.suggestion); }}>Dùng gợi ý</Button>
				</Alert>
			) : null}
			{slugChanged ? <Alert kind="warning">Đổi địa chỉ làm đổi đường dẫn công khai của chuyên mục. Các mục menu trỏ tới chuyên mục này sẽ tự cập nhật; liên kết bạn đã gửi ra ngoài thì không.</Alert> : null}

			{mode.type === "create" ? (
				<SelectField label="Nằm trong chuyên mục" value={parentId} onChange={(e) => setParentId(e.target.value)} error={fields.parentId}>
					<option value="">Không (cấp cao nhất)</option>
					{parents.map((row) => (
						<option key={row.id} value={row.id}>{`${"— ".repeat(row.depth)}${row.name}`}</option>
					))}
				</SelectField>
			) : null}

			<TextArea label="Mô tả ngắn" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} error={fields.description} />
			<SelectField label="Kiểu hiển thị" value={template} onChange={(e) => setTemplate(e.target.value)} error={fields.template}>
				{Object.entries(TEMPLATE_LABELS).map(([value, label]) => (
					<option key={value} value={value}>{label}</option>
				))}
			</SelectField>
			<label className="tq-check">
				<input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
				<span>Hiện chuyên mục này trên trang công khai</span>
			</label>

			<IconChooser value={icon} onChange={setIcon} label={name} error={fields.iconType || fields.iconName || fields.iconSvg || fields.iconMediaId || fields.iconUrl || fields.iconColor} />

			<h3 className="tq-h2" style={{ marginTop: 20 }}>SEO</h3>
			<TextField label="Tiêu đề SEO" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={200} hint="Để trống thì dùng tên chuyên mục." />
			<TextArea label="Mô tả SEO" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} maxLength={400} />
			<div className="tq-field">
				<span className="tq-label">Ảnh chia sẻ (OG)</span>
				{ogMediaId ? (
					<p style={{ display: "flex", alignItems: "center", gap: 10 }}>
						{ogPreview ? <img src={ogPreview} alt="" width={96} style={{ borderRadius: 6 }} /> : null}
						<span className="tq-muted">Đã chọn một ảnh</span>
						<Button variant="link" onClick={() => { setOgMediaId(null); setOgPreview(""); }}>Bỏ ảnh</Button>
					</p>
				) : null}
				{fields.ogMediaId ? <p className="tq-field-error">{fields.ogMediaId}</p> : null}
				{ogPicking ? (
					<MediaPicker
						onCancel={() => setOgPicking(false)}
						onPick={(item) => {
							setOgMediaId(item.id);
							setOgPreview(item.thumbUrl || item.url);
							setOgPicking(false);
						}}
					/>
				) : (
					<Button variant="secondary" onClick={() => setOgPicking(true)}>{ogMediaId ? "Đổi ảnh" : "Chọn ảnh"}</Button>
				)}
			</div>

			<div className="tq-actions" style={{ marginTop: 16, display: "flex", gap: 10 }}>
				<Button type="submit" busy={busy}>{editing ? "Lưu thay đổi" : "Thêm chuyên mục"}</Button>
				<Button variant="secondary" onClick={onCancel} disabled={busy}>Hủy</Button>
			</div>
		</form>
	);
}

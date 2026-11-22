"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, apiList } from "../api";
import { useAdmin } from "../AdminProvider";
import { useDebounced, useLoader } from "../media/imageTools";
import { Alert, Button, EmptyState, errorText, fieldErrors, Loading, PageHeader, SelectField, TextArea, TextField } from "../ui";
import { ConfirmDelete, Feedback, moved, MoveButtons, PictureField, PositionSelect, StatusSelect, type Picture } from "./kit";

type Specs = Record<string, string>;
export type StatueDetail = {
	id: string;
	code: string;
	slug: string;
	name: string;
	subtitle: string;
	assemblyId: string | null;
	clusterId: string | null;
	areaId: string | null;
	isMain: boolean;
	imageMediaId: string | null;
	imageUrl: string;
	imagePosition: string;
	editorialBoard: string;
	specs: Specs;
	quoteText: string;
	quoteAuthor: string;
	body: string;
	status: string;
	version: number;
	images: { mediaId: string; label: string; imagePosition: string; url: string }[];
	related: { id: string; name: string; code: string; imageUrl: string }[];
	variations: { id: string; title: string; location: string; meaning: string; imageMediaId: string | null; imageUrl: string; imagePosition: string; artStatueId: string | null }[];
};
type Options = { assemblies: { id: string; name: string }[]; clusters: { id: string; name: string; assemblyId: string | null; areaId: string | null }[]; areas: { id: string; name: string }[] };
type Found = { id: string; name: string; code: string; imageUrl: string };

// ------------------------------------------------------------------ search a statue

/** A search box over the statues; each result has a "Chọn" button. `skip` hides statues already chosen (or the statue itself). */
export function StatueSearch({ label, skip, onPick }: { label: string; skip: string[]; onPick: (found: Found) => void }) {
	const [q, setQ] = useState("");
	const search = useDebounced(q.trim(), 300);
	const found = useLoader(() => (search ? apiList<Found>(`statues?q=${encodeURIComponent(search)}&pageSize=8`) : Promise.resolve(null)), `statue-search-${search}`);
	const rows = (found.data?.rows ?? []).filter((row) => !skip.includes(row.id));
	return (
		<div role="search">
			<TextField label={label} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên hoặc mã tượng" />
			{found.error ? <Alert kind="error">{found.error}</Alert> : null}
			{search && found.data && rows.length === 0 ? <p className="tq-muted">Không có bảo tượng nào khớp.</p> : null}
			{rows.length ? (
				<ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "grid", gap: 6 }}>
					{rows.map((row) => (
						<li key={row.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
							{row.imageUrl ? <img src={row.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} /> : null}
							<span style={{ flex: 1 }}>
								{row.name} {row.code ? <span className="tq-muted">({row.code})</span> : null}
							</span>
							<Button variant="secondary" onClick={() => onPick(row)} aria-label={`Chọn ${row.name}`}>
								Chọn
							</Button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

// ------------------------------------------------------------------ the three child lists

function useSection(id: string, version: number, onSaved: (detail: StatueDetail) => void) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	async function save(path: string, payload: object, message: string) {
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const detail = await api<StatueDetail>("PUT", `statues/${encodeURIComponent(id)}/${path}`, { version, ...payload });
			onSaved(detail);
			setNotice(message);
		} catch (caught) {
			setError(errorText(caught));
		} finally {
			setBusy(false);
		}
	}
	return { busy, error, notice, save };
}

function ImagesSection({ detail, canEdit, onSaved }: { detail: StatueDetail; canEdit: boolean; onSaved: (detail: StatueDetail) => void }) {
	const [items, setItems] = useState(detail.images);
	const [adding, setAdding] = useState<Picture | null>(null);
	const section = useSection(detail.id, detail.version, (next) => {
		setItems(next.images);
		onSaved(next);
	});
	const edit = (index: number, patch: Partial<StatueDetail["images"][number]>) => setItems((current) => current.map((item, at) => (at === index ? { ...item, ...patch } : item)));
	return (
		<section className="tq-panel" aria-labelledby="st-images">
			<h2 className="tq-h2" id="st-images">
				Ảnh các góc
			</h2>
			<Feedback error={section.error} notice={section.notice} />
			{items.length === 0 ? <EmptyState>Chưa có ảnh góc nào. Ảnh chính của tượng vẫn hiện như thường.</EmptyState> : null}
			<ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
				{items.map((item, index) => (
					<li key={`${item.mediaId}-${index}`} className="tq-panel" style={{ margin: 0 }}>
						<div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
							<img src={item.url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 6 }} />
							<div style={{ flex: 1, minWidth: 200 }}>
								<TextField label={`Tên góc ảnh ${index + 1}`} value={item.label} placeholder="Chính diện, bên trái…" onChange={(e) => edit(index, { label: e.target.value })} disabled={!canEdit} maxLength={60} />
								<PositionSelect value={item.imagePosition} onChange={(value) => edit(index, { imagePosition: value })} />
							</div>
							{canEdit ? (
								<div className="tq-actions" style={{ flexDirection: "column" }}>
									<MoveButtons index={index} length={items.length} label={`ảnh ${index + 1}`} onMove={(to) => setItems(moved(items, index, to))} />
									<Button variant="secondary" onClick={() => setItems(items.filter((_, at) => at !== index))} aria-label={`Gỡ ảnh ${index + 1}`}>
										Gỡ ảnh
									</Button>
								</div>
							) : null}
						</div>
					</li>
				))}
			</ol>
			{canEdit ? (
				<>
					<PictureField
						label="Thêm ảnh góc"
						value={adding}
						onChange={(picture) => {
							if (picture && items.length < 20) setItems([...items, { mediaId: picture.id, label: "", imagePosition: "center 50%", url: picture.url }]);
							setAdding(null);
						}}
					/>
					<Button
						busy={section.busy}
						onClick={() => void section.save("images", { images: items.map((item) => ({ mediaId: item.mediaId, label: item.label, imagePosition: item.imagePosition })) }, "Đã lưu ảnh các góc.")}
					>
						Lưu ảnh các góc
					</Button>
				</>
			) : null}
		</section>
	);
}

function RelatedSection({ detail, canEdit, onSaved }: { detail: StatueDetail; canEdit: boolean; onSaved: (detail: StatueDetail) => void }) {
	const [items, setItems] = useState(detail.related);
	const section = useSection(detail.id, detail.version, (next) => {
		setItems(next.related);
		onSaved(next);
	});
	return (
		<section className="tq-panel" aria-labelledby="st-related">
			<h2 className="tq-h2" id="st-related">
				Bảo tượng liên quan
			</h2>
			<p className="tq-hint">Để trống thì trang công khai tự chọn các tượng chính cùng nhóm, cùng chúng hội.</p>
			<Feedback error={section.error} notice={section.notice} />
			{items.length === 0 ? <EmptyState>Chưa chọn tượng nào.</EmptyState> : null}
			<ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
				{items.map((item, index) => (
					<li key={item.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
						{item.imageUrl ? <img src={item.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4 }} /> : null}
						<span style={{ flex: 1 }}>
							{item.name} {item.code ? <span className="tq-muted">({item.code})</span> : null}
						</span>
						{canEdit ? (
							<>
								<MoveButtons index={index} length={items.length} label={item.name} onMove={(to) => setItems(moved(items, index, to))} />
								<Button variant="secondary" onClick={() => setItems(items.filter((_, at) => at !== index))} aria-label={`Gỡ ${item.name}`}>
									Gỡ
								</Button>
							</>
						) : null}
					</li>
				))}
			</ol>
			{canEdit ? (
				<>
					{items.length < 12 ? <StatueSearch label="Tìm tượng để thêm" skip={[detail.id, ...items.map((item) => item.id)]} onPick={(found) => setItems([...items, found])} /> : <p className="tq-muted">Đã đủ 12 tượng.</p>}
					<Button busy={section.busy} onClick={() => void section.save("related", { related: items.map((item) => item.id) }, "Đã lưu danh sách tượng liên quan.")}>
						Lưu tượng liên quan
					</Button>
				</>
			) : null}
		</section>
	);
}

type Variation = StatueDetail["variations"][number] & { artName?: string };

function VariationsSection({ detail, canEdit, onSaved }: { detail: StatueDetail; canEdit: boolean; onSaved: (detail: StatueDetail) => void }) {
	const [items, setItems] = useState<Variation[]>(detail.variations);
	const section = useSection(detail.id, detail.version, (next) => {
		setItems(next.variations);
		onSaved(next);
	});
	const edit = (index: number, patch: Partial<Variation>) => setItems((current) => current.map((item, at) => (at === index ? { ...item, ...patch } : item)));
	return (
		<section className="tq-panel" aria-labelledby="st-art">
			<h2 className="tq-h2" id="st-art">
				Tác phẩm nghệ thuật Phật giáo
			</h2>
			<Feedback error={section.error} notice={section.notice} />
			{items.length === 0 ? <EmptyState>Chưa có tác phẩm nào.</EmptyState> : null}
			<ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
				{items.map((item, index) => (
					<li key={item.id || `new-${index}`} className="tq-panel" style={{ margin: 0 }}>
						<TextField label={`Tên tác phẩm ${index + 1}`} value={item.title} onChange={(e) => edit(index, { title: e.target.value })} disabled={!canEdit} maxLength={200} />
						<TextField label="Nơi lưu giữ" value={item.location} onChange={(e) => edit(index, { location: e.target.value })} disabled={!canEdit} maxLength={200} />
						<TextArea label="Ý nghĩa" value={item.meaning} onChange={(e) => edit(index, { meaning: e.target.value })} disabled={!canEdit} />
						<PictureField label="Ảnh tác phẩm" value={item.imageMediaId ? { id: item.imageMediaId, url: item.imageUrl } : null} onChange={(picture) => edit(index, { imageMediaId: picture?.id ?? null, imageUrl: picture?.url ?? "" })} disabled={!canEdit} />
						<PositionSelect value={item.imagePosition} onChange={(value) => edit(index, { imagePosition: value })} />
						<p className="tq-hint">{item.artStatueId ? `Liên kết tới bảo tượng: ${item.artName ?? item.artStatueId}` : "Chưa liên kết bảo tượng nào."}</p>
						{canEdit ? (
							<>
								{item.artStatueId ? (
									<Button variant="secondary" onClick={() => edit(index, { artStatueId: null, artName: undefined })}>
										Bỏ liên kết tượng
									</Button>
								) : (
									<StatueSearch label="Liên kết tới bảo tượng (tùy chọn)" skip={[detail.id]} onPick={(found) => edit(index, { artStatueId: found.id, artName: found.name })} />
								)}
								<div className="tq-actions" style={{ marginTop: 8 }}>
									<MoveButtons index={index} length={items.length} label={`tác phẩm ${index + 1}`} onMove={(to) => setItems(moved(items, index, to))} />
									<Button variant="secondary" onClick={() => setItems(items.filter((_, at) => at !== index))}>
										Bỏ tác phẩm
									</Button>
								</div>
							</>
						) : null}
					</li>
				))}
			</ol>
			{canEdit ? (
				<div className="tq-actions">
					<Button variant="secondary" disabled={items.length >= 30} onClick={() => setItems([...items, { id: "", title: "", location: "", meaning: "", imageMediaId: null, imageUrl: "", imagePosition: "center 50%", artStatueId: null }])}>
						Thêm tác phẩm
					</Button>
					<Button
						busy={section.busy}
						onClick={() =>
							void section.save(
								"variations",
								{ variations: items.map((item) => ({ id: item.id || undefined, title: item.title, location: item.location, meaning: item.meaning, imageMediaId: item.imageMediaId, imagePosition: item.imagePosition, artStatueId: item.artStatueId })) },
								"Đã lưu các tác phẩm.",
							)
						}
					>
						Lưu các tác phẩm
					</Button>
				</div>
			) : null}
		</section>
	);
}

// ------------------------------------------------------------------ the statue itself

type Form = {
	name: string;
	code: string;
	slug: string;
	subtitle: string;
	assemblyId: string;
	clusterId: string;
	areaId: string;
	isMain: boolean;
	picture: Picture | null;
	imagePosition: string;
	editorialBoard: string;
	specs: { key: string; value: string }[];
	quoteText: string;
	quoteAuthor: string;
	body: string;
	status: string;
};

const blank: Form = { name: "", code: "", slug: "", subtitle: "", assemblyId: "", clusterId: "", areaId: "", isMain: true, picture: null, imagePosition: "center 50%", editorialBoard: "", specs: [], quoteText: "", quoteAuthor: "", body: "", status: "draft" };

const fromDetail = (detail: StatueDetail): Form => ({
	name: detail.name, code: detail.code, slug: detail.slug, subtitle: detail.subtitle, assemblyId: detail.assemblyId ?? "", clusterId: detail.clusterId ?? "", areaId: detail.areaId ?? "", isMain: detail.isMain,
	picture: detail.imageMediaId ? { id: detail.imageMediaId, url: detail.imageUrl } : null, imagePosition: detail.imagePosition, editorialBoard: detail.editorialBoard,
	specs: Object.entries(detail.specs).map(([key, value]) => ({ key, value })), quoteText: detail.quoteText, quoteAuthor: detail.quoteAuthor, body: detail.body, status: detail.status === "pending" || detail.status === "scheduled" ? "draft" : detail.status,
});

const payload = (form: Form) => ({
	name: form.name, code: form.code, slug: form.slug, subtitle: form.subtitle, assemblyId: form.assemblyId || null, clusterId: form.clusterId || null, areaId: form.areaId || null, isMain: form.isMain,
	imageMediaId: form.picture?.id ?? null, imagePosition: form.imagePosition, editorialBoard: form.editorialBoard,
	specs: Object.fromEntries(form.specs.filter((item) => item.key.trim()).map((item) => [item.key.trim(), item.value])), quoteText: form.quoteText, quoteAuthor: form.quoteAuthor, body: form.body, status: form.status,
});

export function StatueForm({ id }: { id: string | null }) {
	const router = useRouter();
	const { can } = useAdmin();
	const loaded = useLoader(() => (id ? api<StatueDetail>("GET", `statues/${encodeURIComponent(id)}`) : Promise.resolve(null)), `statue-${id ?? "new"}`);
	const options = useLoader(() => api<Options>("GET", "statues/options"), "statue-options");
	const [detail, setDetail] = useState<StatueDetail | null>(null);
	const [seen, setSeen] = useState<StatueDetail | null>(null);
	const [form, setForm] = useState<Form>(blank);
	const [busy, setBusy] = useState("");
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState("");
	const [newCluster, setNewCluster] = useState("");
	const [clusters, setClusters] = useState<Options["clusters"]>([]);

	if (loaded.data && loaded.data !== seen) {
		setSeen(loaded.data);
		setDetail(loaded.data);
		setForm(fromDetail(loaded.data));
	}

	const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
	// A published statue is on the site: only someone who may publish edits or trashes it (the server refuses the rest).
	const lockedLive = Boolean(id) && detail?.status === "published" && !can("statues", "publish");
	const canEdit = (id ? can("statues", "update") : can("statues", "create")) && !lockedLive;
	const clusterOptions = [...(options.data?.clusters ?? []), ...clusters];

	async function save(event: FormEvent) {
		event.preventDefault();
		setBusy("save");
		setError("");
		setFields({});
		setNotice("");
		try {
			if (id && detail) {
				const saved = await api<StatueDetail>("PATCH", `statues/${encodeURIComponent(id)}`, { ...payload(form), version: detail.version });
				setDetail(saved);
				setForm(fromDetail(saved));
				setNotice("Đã lưu bảo tượng.");
			} else {
				const created = await api<StatueDetail>("POST", "statues", payload(form));
				router.replace(`/quan-tri/bao-tuong/${created.id}`);
			}
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		} finally {
			setBusy("");
		}
	}

	async function suggestCode() {
		try {
			set("code", (await api<{ code: string }>("GET", "statues/next-code")).code);
		} catch (caught) {
			setError(errorText(caught));
		}
	}

	async function addCluster() {
		if (!newCluster.trim()) return;
		setBusy("cluster");
		try {
			const made = await api<Options["clusters"][number]>("POST", "statues/clusters", { name: newCluster, assemblyId: form.assemblyId || null, areaId: form.areaId || null });
			setClusters((current) => [...current, made]);
			set("clusterId", made.id);
			setNewCluster("");
		} catch (caught) {
			setError(errorText(caught));
		} finally {
			setBusy("");
		}
	}

	async function remove() {
		if (!id) return;
		setBusy("delete");
		try {
			await api("DELETE", `statues/${encodeURIComponent(id)}`);
			router.replace("/quan-tri/bao-tuong");
		} catch (caught) {
			setError(errorText(caught));
			setBusy("");
		}
	}

	const back = (
		<Link href="/quan-tri/bao-tuong" className="tq-back">
			← Bảo tượng
		</Link>
	);
	if (id && loaded.error && !detail) {
		return (
			<>
				<PageHeader title="Bảo tượng" back={back} />
				<Alert kind="error">{loaded.error}</Alert>
				<Button variant="secondary" onClick={loaded.reload}>
					Thử lại
				</Button>
			</>
		);
	}
	if (id && !detail) return <Loading />;

	return (
		<>
			<PageHeader title={id ? `Sửa bảo tượng: ${detail?.name ?? ""}` : "Thêm bảo tượng"} back={back} />
			<form className="tq-panel" onSubmit={save} noValidate>
				{lockedLive && can("statues", "update") ? <Alert kind="info">Mục này đang hiện trên trang công khai. Chỉ người có quyền xuất bản mới sửa hoặc xóa được; hãy nhờ biên tập viên.</Alert> : null}
				<Feedback error={error} notice={notice} />
				<TextField label="Tên bảo tượng" value={form.name} onChange={(e) => set("name", e.target.value)} error={fields.name} required maxLength={200} disabled={!canEdit} />
				<div className="tq-toolbar">
					<TextField label="Mã tượng" value={form.code} onChange={(e) => set("code", e.target.value)} error={fields.code} hint="Ví dụ TP0001. Có thể để trống." maxLength={20} disabled={!canEdit} />
					{canEdit ? (
						<Button variant="secondary" onClick={() => void suggestCode()}>
							Gợi ý mã kế tiếp
						</Button>
					) : null}
				</div>
				<TextField label="Địa chỉ trang (slug)" value={form.slug} onChange={(e) => set("slug", e.target.value)} error={fields.slug} hint="Để trống để tự tạo từ tên. Đổi địa chỉ của tượng đã đăng sẽ làm link cũ không còn dùng được." maxLength={160} disabled={!canEdit} />
				<TextField label="Tiêu đề phụ" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} error={fields.subtitle} maxLength={300} disabled={!canEdit} />
				<label className="tq-check">
					<input type="checkbox" checked={form.isMain} onChange={(e) => set("isMain", e.target.checked)} disabled={!canEdit} />
					<span>Tượng chính (bỏ chọn nếu là tác phẩm nghệ thuật Phật giáo)</span>
				</label>
				<div className="tq-toolbar">
					<SelectField label="Chúng hội" value={form.assemblyId} onChange={(e) => set("assemblyId", e.target.value)} error={fields.assemblyId} disabled={!canEdit}>
						<option value="">Chưa chọn</option>
						{(options.data?.assemblies ?? []).map((item) => (
							<option key={item.id} value={item.id}>
								{item.name}
							</option>
						))}
					</SelectField>
					<SelectField label="Khu vực" value={form.areaId} onChange={(e) => set("areaId", e.target.value)} error={fields.areaId} disabled={!canEdit}>
						<option value="">Chưa chọn</option>
						{(options.data?.areas ?? []).map((item) => (
							<option key={item.id} value={item.id}>
								{item.name}
							</option>
						))}
					</SelectField>
					<SelectField label="Nhóm tượng" value={form.clusterId} onChange={(e) => set("clusterId", e.target.value)} error={fields.clusterId} disabled={!canEdit}>
						<option value="">Không thuộc nhóm nào</option>
						{clusterOptions.map((item) => (
							<option key={item.id} value={item.id}>
								{item.name}
							</option>
						))}
					</SelectField>
				</div>
				{canEdit && can("statues", "create") ? (
					<div className="tq-toolbar">
						<TextField label="Tạo nhóm tượng mới" value={newCluster} onChange={(e) => setNewCluster(e.target.value)} placeholder="Ví dụ: Hoa Nghiêm Tam Thánh" maxLength={120} />
						<Button variant="secondary" busy={busy === "cluster"} onClick={() => void addCluster()}>
							Thêm nhóm
						</Button>
					</div>
				) : null}

				<PictureField label="Ảnh chính" value={form.picture} onChange={(value) => set("picture", value)} disabled={!canEdit} error={fields.imageMediaId} />
				<PositionSelect value={form.imagePosition} onChange={(value) => set("imagePosition", value)} />
				<TextArea label="Ban biên tập" rows={3} value={form.editorialBoard} onChange={(e) => set("editorialBoard", e.target.value)} error={fields.editorialBoard} disabled={!canEdit} />

				<fieldset className="tq-field" style={{ border: 0, padding: 0 }}>
					<legend className="tq-label">Thông số (chất liệu, kích thước, niên đại, xuất xứ…)</legend>
					{form.specs.map((item, index) => (
						<div className="tq-toolbar" key={index}>
							<TextField label={`Tên thông số ${index + 1}`} value={item.key} maxLength={60} disabled={!canEdit} onChange={(e) => set("specs", form.specs.map((old, at) => (at === index ? { ...old, key: e.target.value } : old)))} />
							<TextField label={`Giá trị ${index + 1}`} value={item.value} maxLength={300} disabled={!canEdit} onChange={(e) => set("specs", form.specs.map((old, at) => (at === index ? { ...old, value: e.target.value } : old)))} />
							{canEdit ? (
								<Button variant="secondary" onClick={() => set("specs", form.specs.filter((_, at) => at !== index))} aria-label={`Bỏ thông số ${index + 1}`}>
									Bỏ
								</Button>
							) : null}
						</div>
					))}
					{fields.specs ? <p className="tq-field-error">{fields.specs}</p> : null}
					{canEdit ? (
						<Button variant="secondary" disabled={form.specs.length >= 20} onClick={() => set("specs", [...form.specs, { key: "", value: "" }])}>
							Thêm thông số
						</Button>
					) : null}
				</fieldset>

				<TextArea label="Lời dạy trích dẫn" rows={3} value={form.quoteText} onChange={(e) => set("quoteText", e.target.value)} error={fields.quoteText} disabled={!canEdit} />
				<TextField label="Tác giả lời dạy" value={form.quoteAuthor} onChange={(e) => set("quoteAuthor", e.target.value)} error={fields.quoteAuthor} disabled={!canEdit} maxLength={200} />
				<TextArea
					label="Bài viết (HTML)"
					rows={12}
					value={form.body}
					onChange={(e) => set("body", e.target.value)}
					error={fields.body}
					disabled={!canEdit}
					hint="Chỉ giữ các thẻ p, br, strong, em, ul, ol, li, blockquote, h2–h4 và liên kết a (https hoặc đường dẫn trong site). Mọi thứ khác bị gỡ khi lưu."
				/>
				<StatusSelect value={form.status} onChange={(value) => set("status", value)} canPublish={can("statues", "publish")} error={fields.status} />
				{canEdit ? (
					<Button type="submit" busy={busy === "save"}>
						Lưu bảo tượng
					</Button>
				) : null}
			</form>

			{id && detail ? (
				<>
					<ImagesSection detail={detail} canEdit={can("statues", "update") && !lockedLive} onSaved={setDetail} />
					<RelatedSection detail={detail} canEdit={can("statues", "update") && !lockedLive} onSaved={setDetail} />
					<VariationsSection detail={detail} canEdit={can("statues", "update") && !lockedLive} onSaved={setDetail} />
					{can("statues", "delete") && !lockedLive ? <ConfirmDelete what="bảo tượng" busy={busy === "delete"} onConfirm={() => void remove()} /> : null}
				</>
			) : null}
		</>
	);
}

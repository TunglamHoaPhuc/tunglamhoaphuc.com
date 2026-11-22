"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAdmin } from "../AdminProvider";
import { useDebounced, useLoader } from "../media/imageTools";
import { Alert, Button, errorText, fieldErrors, Loading, PageHeader, SelectField, TextArea, TextField } from "../ui";
import { ConfirmDelete, Feedback, PictureField, PositionSelect, StatusSelect, type Picture } from "./kit";

export type EventRow = {
	id: string;
	title: string;
	slug: string;
	subtitle: string;
	categoryId: string | null;
	categoryName: string;
	startDate: string;
	endDate: string;
	times: { label: string; time: string }[];
	location: string;
	description: string;
	notes: string;
	imageMediaId: string | null;
	imageUrl: string;
	imagePosition: string;
	video: { id: string; url: string } | null;
	linkedPostId: string | null;
	registrationStatus: "closed" | "open" | "full";
	status: string;
	lunarManual: boolean;
	lunar: { day: number; month: number; year: number; leap: boolean; manual: boolean } | null;
	version: number;
};
type Category = { id: string; slug: string; name: string };
type Lunar = { day: number; month: number; year: number; leap: boolean };

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

type Form = {
	title: string;
	slug: string;
	subtitle: string;
	categoryId: string;
	startDate: string;
	endDate: string;
	times: { label: string; time: string }[];
	location: string;
	description: string;
	notes: string;
	picture: Picture | null;
	imagePosition: string;
	videoUrl: string;
	linkedPostId: string;
	registrationStatus: string;
	status: string;
	lunarManual: boolean;
	lunar: { day: string; month: string; year: string; leap: boolean };
};

const blank = (date: string): Form => ({
	title: "", slug: "", subtitle: "", categoryId: "", startDate: date, endDate: date, times: [], location: "", description: "", notes: "", picture: null, imagePosition: "center 50%",
	videoUrl: "", linkedPostId: "", registrationStatus: "closed", status: "draft", lunarManual: false, lunar: { day: "1", month: "1", year: String(new Date().getFullYear()), leap: false },
});

const fromRow = (row: EventRow): Form => ({
	title: row.title, slug: row.slug, subtitle: row.subtitle, categoryId: row.categoryId ?? "", startDate: row.startDate, endDate: row.endDate, times: row.times.map((item) => ({ ...item })),
	location: row.location, description: row.description, notes: row.notes, picture: row.imageMediaId ? { id: row.imageMediaId, url: row.imageUrl } : null, imagePosition: row.imagePosition,
	videoUrl: row.video?.url ?? "", linkedPostId: row.linkedPostId ?? "", registrationStatus: row.registrationStatus, status: row.status === "pending" || row.status === "scheduled" ? "draft" : row.status,
	lunarManual: row.lunarManual, lunar: { day: String(row.lunar?.day ?? 1), month: String(row.lunar?.month ?? 1), year: String(row.lunar?.year ?? new Date().getFullYear()), leap: row.lunar?.leap ?? false },
});

function body(form: Form) {
	const manual: Lunar | null = form.lunarManual ? { day: Number(form.lunar.day), month: Number(form.lunar.month), year: Number(form.lunar.year), leap: form.lunar.leap } : null;
	return {
		title: form.title,
		slug: form.slug,
		subtitle: form.subtitle,
		categoryId: form.categoryId || null,
		startDate: form.startDate,
		endDate: form.endDate || form.startDate,
		times: form.times.filter((item) => item.label.trim() || item.time.trim()),
		location: form.location,
		description: form.description,
		notes: form.notes,
		imageMediaId: form.picture?.id ?? null,
		imagePosition: form.imagePosition,
		video: form.videoUrl.trim() ? { url: form.videoUrl.trim() } : null,
		linkedPostId: form.linkedPostId.trim() || null,
		registrationStatus: form.registrationStatus,
		status: form.status,
		lunarManual: form.lunarManual,
		lunar: manual,
	};
}

export function EventForm({ id, initialDate }: { id: string | null; initialDate?: string }) {
	const router = useRouter();
	const { can } = useAdmin();
	const loaded = useLoader(() => (id ? api<EventRow>("GET", `events/${encodeURIComponent(id)}`) : Promise.resolve(null)), `event-${id ?? "new"}`);
	const categories = useLoader(() => api<{ categories: Category[] }>("GET", "events/categories"), "event-categories");
	const [row, setRow] = useState<EventRow | null>(null);
	const [form, setForm] = useState<Form>(() => blank(initialDate && isDate(initialDate) ? initialDate : new Date().toISOString().slice(0, 10)));
	const [seen, setSeen] = useState<EventRow | null>(null);
	const [busy, setBusy] = useState("");
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState("");

	// The loaded record seeds the form once per load; a save puts its own answer in the form.
	if (loaded.data && loaded.data !== seen) {
		setSeen(loaded.data);
		setRow(loaded.data);
		setForm(fromRow(loaded.data));
	}

	const [preview, setPreview] = useState<{ key: string; text: string } | null>(null);
	const startDate = useDebounced(form.startDate, 300);
	useEffect(() => {
		if (form.lunarManual || !isDate(startDate)) return;
		let alive = true;
		api<Lunar>("GET", `events/lunar?date=${startDate}`)
			.then((data) => alive && setPreview({ key: startDate, text: `${data.day}/${data.month}${data.leap ? " (nhuận)" : ""} năm ${data.year}` }))
			.catch(() => alive && setPreview(null));
		return () => {
			alive = false;
		};
	}, [startDate, form.lunarManual]);

	const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
	const canPublish = can("events", "publish");
	// A published event is on the site: only someone who may publish edits or trashes it (the server refuses the rest).
	const lockedLive = Boolean(id) && row?.status === "published" && !canPublish;
	const canUpdate = (id ? can("events", "update") : can("events", "create")) && !lockedLive;

	async function save(event: FormEvent) {
		event.preventDefault();
		setBusy("save");
		setError("");
		setFields({});
		setNotice("");
		try {
			if (id && row) {
				const saved = await api<EventRow>("PATCH", `events/${encodeURIComponent(id)}`, { ...body(form), version: row.version });
				setRow(saved);
				setForm(fromRow(saved));
				setNotice("Đã lưu sự kiện.");
			} else {
				const created = await api<EventRow>("POST", "events", body(form));
				router.replace(`/quan-tri/lich-tu-hoc/${created.id}`);
			}
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		} finally {
			setBusy("");
		}
	}

	async function duplicate() {
		if (!id) return;
		setBusy("copy");
		setError("");
		try {
			const copy = await api<EventRow>("POST", `events/${encodeURIComponent(id)}/duplicate`);
			router.push(`/quan-tri/lich-tu-hoc/${copy.id}`);
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
			await api("DELETE", `events/${encodeURIComponent(id)}`);
			router.replace("/quan-tri/lich-tu-hoc");
		} catch (caught) {
			setError(errorText(caught));
			setBusy("");
		}
	}

	const back = (
		<Link href="/quan-tri/lich-tu-hoc" className="tq-back">
			← Lịch tu học
		</Link>
	);
	if (id && loaded.error && !row) {
		return (
			<>
				<PageHeader title="Sự kiện" back={back} />
				<Alert kind="error">{loaded.error}</Alert>
				<Button variant="secondary" onClick={loaded.reload}>
					Thử lại
				</Button>
			</>
		);
	}
	if (id && !row) return <Loading />;

	return (
		<>
			<PageHeader title={id ? "Sửa sự kiện" : "Thêm sự kiện"} back={back} />
			<form className="tq-panel" onSubmit={save} noValidate>
				{lockedLive && can("events", "update") ? <Alert kind="info">Mục này đang hiện trên trang công khai. Chỉ người có quyền xuất bản mới sửa hoặc xóa được; hãy nhờ biên tập viên.</Alert> : null}
				<Feedback error={error} notice={notice} />
				<TextField label="Tiêu đề" value={form.title} onChange={(e) => set("title", e.target.value)} error={fields.title} required maxLength={160} />
				<TextField label="Địa chỉ trang (slug)" value={form.slug} onChange={(e) => set("slug", e.target.value)} error={fields.slug} hint="Để trống để tự tạo từ tiêu đề." maxLength={160} />
				<TextField label="Tiêu đề phụ" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} error={fields.subtitle} maxLength={200} />
				<SelectField label="Loại sự kiện" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} error={fields.categoryId}>
					<option value="">Chưa phân loại</option>
					{(categories.data?.categories ?? []).map((category) => (
						<option key={category.id} value={category.id}>
							{category.name}
						</option>
					))}
				</SelectField>

				<div className="tq-toolbar">
					<TextField label="Ngày bắt đầu" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} error={fields.startDate} required />
					<TextField label="Ngày kết thúc" type="date" value={form.endDate} min={form.startDate} onChange={(e) => set("endDate", e.target.value)} error={fields.endDate} />
				</div>
				<fieldset className="tq-field" style={{ border: 0, padding: 0 }}>
					<legend className="tq-label">Ngày âm lịch của ngày bắt đầu</legend>
					<label className="tq-check">
						<input type="checkbox" checked={form.lunarManual} onChange={(e) => set("lunarManual", e.target.checked)} />
						<span>Tự nhập ngày âm lịch (mặc định máy tính từ ngày dương)</span>
					</label>
					{form.lunarManual ? (
						<div className="tq-toolbar">
							<TextField label="Ngày âm" type="number" min={1} max={30} value={form.lunar.day} onChange={(e) => set("lunar", { ...form.lunar, day: e.target.value })} />
							<TextField label="Tháng âm" type="number" min={1} max={12} value={form.lunar.month} onChange={(e) => set("lunar", { ...form.lunar, month: e.target.value })} />
							<TextField label="Năm âm" type="number" value={form.lunar.year} onChange={(e) => set("lunar", { ...form.lunar, year: e.target.value })} />
							<label className="tq-check">
								<input type="checkbox" checked={form.lunar.leap} onChange={(e) => set("lunar", { ...form.lunar, leap: e.target.checked })} />
								<span>Tháng nhuận</span>
							</label>
						</div>
					) : (
						<p className="tq-hint" role="status">
							{preview && preview.key === form.startDate ? `Âm lịch: ${preview.text}` : "Nhập ngày bắt đầu để xem ngày âm lịch."}
						</p>
					)}
					{fields.lunar ? <p className="tq-field-error">{fields.lunar}</p> : null}
				</fieldset>

				<fieldset className="tq-field" style={{ border: 0, padding: 0 }}>
					<legend className="tq-label">Các mốc giờ</legend>
					{form.times.map((item, index) => (
						<div className="tq-toolbar" key={index}>
							<TextField label={`Tên mốc ${index + 1}`} value={item.label} placeholder="Khai khóa" onChange={(e) => set("times", form.times.map((old, at) => (at === index ? { ...old, label: e.target.value } : old)))} />
							<TextField label={`Giờ ${index + 1}`} value={item.time} placeholder="07h30" onChange={(e) => set("times", form.times.map((old, at) => (at === index ? { ...old, time: e.target.value } : old)))} />
							<Button variant="secondary" onClick={() => set("times", form.times.filter((_, at) => at !== index))} aria-label={`Bỏ mốc giờ ${index + 1}`}>
								Bỏ
							</Button>
						</div>
					))}
					{fields.times ? <p className="tq-field-error">{fields.times}</p> : null}
					<Button variant="secondary" onClick={() => set("times", [...form.times, { label: "", time: "" }])} disabled={form.times.length >= 12}>
						Thêm mốc giờ
					</Button>
				</fieldset>

				<TextField label="Địa điểm" value={form.location} onChange={(e) => set("location", e.target.value)} error={fields.location} maxLength={200} />
				<TextArea label="Mô tả" rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} error={fields.description} />
				<TextArea label="Ghi chú cho người tham dự" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} error={fields.notes} />
				<PictureField label="Ảnh sự kiện" value={form.picture} onChange={(value) => set("picture", value)} error={fields.imageMediaId} />
				<PositionSelect value={form.imagePosition} onChange={(value) => set("imagePosition", value)} />
				<TextField label="Video YouTube" type="url" value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} error={fields.video} hint="Dán đường dẫn YouTube, ví dụ https://youtu.be/…" />
				<TextField label="Mã bài viết liên kết" value={form.linkedPostId} onChange={(e) => set("linkedPostId", e.target.value)} error={fields.linkedPostId} hint="Tùy chọn: mã của bài viết tường thuật sự kiện này (xem trong trang Bài viết)." />
				<SelectField label="Đăng ký tham dự" value={form.registrationStatus} onChange={(e) => set("registrationStatus", e.target.value)} error={fields.registrationStatus}>
					<option value="closed">Không nhận đăng ký</option>
					<option value="open">Đang mở đăng ký</option>
					<option value="full">Đã đủ người</option>
				</SelectField>
				<StatusSelect value={form.status} onChange={(value) => set("status", value)} canPublish={canPublish} error={fields.status} />

				<div className="tq-actions">
					{canUpdate ? (
						<Button type="submit" busy={busy === "save"}>
							Lưu sự kiện
						</Button>
					) : null}
					{id && can("events", "create") ? (
						<Button variant="secondary" busy={busy === "copy"} onClick={() => void duplicate()}>
							Nhân bản
						</Button>
					) : null}
				</div>
			</form>
			{id && can("events", "delete") && !lockedLive ? <ConfirmDelete what="sự kiện" busy={busy === "delete"} onConfirm={() => void remove()} /> : null}
		</>
	);
}

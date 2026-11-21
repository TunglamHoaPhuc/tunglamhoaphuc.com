"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useAdmin } from "../AdminProvider";
import { useLoader } from "../media/imageTools";
import { Alert, Badge, Button, EmptyState, errorText, fieldErrors, Loading, PageHeader, SelectField, TextArea, TextField } from "../ui";
import { Feedback, PictureField, PositionSelect, type Picture } from "./kit";

type Theme = { month: number; title: string; posterMediaId: string | null; posterUrl: string; lines: string[]; author: string };
type Program = { id: string; title: string; subtitle: string; summary: string; time: string; duration: string; location: string; imageMediaId: string | null; imageUrl: string; imagePosition: string; position: number };

/** Verse lines are kept as HTML with <b> only; the editor sees and types them as text lines. */
const toText = (lines: string[]) => lines.join("\n");

function ThemeForm({ theme, canEdit, onSaved }: { theme: Theme; canEdit: boolean; onSaved: (theme: Theme) => void }) {
	const [title, setTitle] = useState(theme.title);
	const [author, setAuthor] = useState(theme.author);
	const [lines, setLines] = useState(toText(theme.lines));
	const [poster, setPoster] = useState<Picture | null>(theme.posterMediaId ? { id: theme.posterMediaId, url: theme.posterUrl } : null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState("");

	async function save(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setFields({});
		setNotice("");
		try {
			const saved = await api<Theme>("PUT", `events/themes/${theme.month}`, { title, author, posterMediaId: poster?.id ?? null, lines: lines.split("\n") });
			setLines(toText(saved.lines));
			setNotice(`Đã lưu chủ đề tháng ${theme.month}.`);
			onSaved(saved);
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		} finally {
			setBusy(false);
		}
	}

	return (
		<form className="tq-panel" onSubmit={save} noValidate aria-label={`Chủ đề tháng ${theme.month}`}>
			<Feedback error={error} notice={notice} />
			<TextField label="Tên chủ đề" value={title} onChange={(e) => setTitle(e.target.value)} error={fields.title} disabled={!canEdit} maxLength={160} />
			<PictureField label="Ảnh poster của tháng" value={poster} onChange={setPoster} disabled={!canEdit} error={fields.posterMediaId} />
			<TextArea
				label="Các dòng kệ (mỗi dòng một câu)"
				rows={6}
				value={lines}
				onChange={(e) => setLines(e.target.value)}
				error={fields.lines}
				disabled={!canEdit}
				hint="Bọc chữ cần in đậm trong <b>…</b>. Mọi thẻ khác được hiển thị nguyên văn như chữ."
			/>
			<TextField label="Tác giả" value={author} onChange={(e) => setAuthor(e.target.value)} error={fields.author} disabled={!canEdit} maxLength={120} />
			{canEdit ? (
				<Button type="submit" busy={busy}>
					Lưu chủ đề tháng {theme.month}
				</Button>
			) : null}
		</form>
	);
}

function ProgramForm({ program, canEdit, onSaved }: { program: Program; canEdit: boolean; onSaved: (programs: Program[]) => void }) {
	const [form, setForm] = useState({ title: program.title, subtitle: program.subtitle, summary: program.summary, time: program.time, duration: program.duration, location: program.location, imagePosition: program.imagePosition });
	const [picture, setPicture] = useState<Picture | null>(program.imageMediaId ? { id: program.imageMediaId, url: program.imageUrl } : null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState("");
	const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

	async function save(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setFields({});
		setNotice("");
		try {
			const result = await api<{ programs: Program[] }>("PATCH", `events/programs/${encodeURIComponent(program.id)}`, { ...form, imageMediaId: picture?.id ?? null });
			setNotice("Đã lưu chương trình.");
			onSaved(result.programs);
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		} finally {
			setBusy(false);
		}
	}

	return (
		<form className="tq-panel" onSubmit={save} noValidate aria-label={`Chương trình ${program.title}`}>
			<h3 className="tq-h2">{program.title}</h3>
			<Feedback error={error} notice={notice} />
			<TextField label="Tên chương trình" value={form.title} onChange={(e) => set("title", e.target.value)} error={fields.title} disabled={!canEdit} />
			<TextField label="Tiêu đề phụ" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} error={fields.subtitle} disabled={!canEdit} />
			<TextArea label="Giới thiệu ngắn" value={form.summary} onChange={(e) => set("summary", e.target.value)} error={fields.summary} disabled={!canEdit} />
			<div className="tq-toolbar">
				<TextField label="Giờ" value={form.time} onChange={(e) => set("time", e.target.value)} error={fields.time} disabled={!canEdit} />
				<TextField label="Thời lượng" value={form.duration} onChange={(e) => set("duration", e.target.value)} error={fields.duration} disabled={!canEdit} />
				<TextField label="Địa điểm" value={form.location} onChange={(e) => set("location", e.target.value)} error={fields.location} disabled={!canEdit} />
			</div>
			<PictureField label="Ảnh" value={picture} onChange={setPicture} disabled={!canEdit} error={fields.imageMediaId} />
			<PositionSelect value={form.imagePosition} onChange={(value) => set("imagePosition", value)} />
			{canEdit ? (
				<Button type="submit" busy={busy}>
					Lưu chương trình
				</Button>
			) : null}
		</form>
	);
}

export function ThemesManager() {
	const { can } = useAdmin();
	const canEdit = can("events", "update");
	const themes = useLoader(() => api<{ themes: Theme[] }>("GET", "events/themes"), "themes");
	const programs = useLoader(() => api<{ programs: Program[] }>("GET", "events/programs"), "programs");
	const [month, setMonth] = useState(() => new Date(Date.now() + 7 * 3_600_000).getUTCMonth() + 1);
	const [saved, setSaved] = useState<Record<number, Theme>>({});
	const [programList, setProgramList] = useState<Program[] | null>(null);
	const theme = themes.data?.themes.find((item) => item.month === month);

	return (
		<>
			<PageHeader
				title="Chủ đề tháng và chương trình định kỳ"
				back={
					<Link href="/quan-tri/lich-tu-hoc" className="tq-back">
						← Lịch tu học
					</Link>
				}
			/>

			<h2 className="tq-h2">Chủ đề của từng tháng</h2>
			<p className="tq-muted">Poster, câu kệ và tác giả hiện ở khối “Lời Thầy dạy” trên trang chủ và ở trang lịch tu học.</p>
			{themes.error ? (
				<>
					<Alert kind="error">{themes.error}</Alert>
					<Button variant="secondary" onClick={themes.reload}>
						Thử lại
					</Button>
				</>
			) : !themes.data ? (
				<Loading />
			) : (
				<>
					<SelectField label="Chọn tháng" value={String(month)} onChange={(e) => setMonth(Number(e.target.value))}>
						{themes.data.themes.map((item) => {
							const now = saved[item.month] ?? item;
							return (
								<option key={item.month} value={item.month}>
									Tháng {item.month}
									{now.title ? ` · ${now.title}` : " · (chưa có)"}
								</option>
							);
						})}
					</SelectField>
					{theme ? <ThemeForm key={month} theme={saved[month] ?? theme} canEdit={canEdit} onSaved={(value) => setSaved((current) => ({ ...current, [value.month]: value }))} /> : null}
				</>
			)}

			<h2 className="tq-h2">Chương trình định kỳ</h2>
			{programs.error ? (
				<>
					<Alert kind="error">{programs.error}</Alert>
					<Button variant="secondary" onClick={programs.reload}>
						Thử lại
					</Button>
				</>
			) : !programs.data ? (
				<Loading />
			) : (programList ?? programs.data.programs).length === 0 ? (
				<EmptyState>
					Chưa có chương trình định kỳ nào. <Badge>Danh sách này được nạp cùng dữ liệu cũ.</Badge>
				</EmptyState>
			) : (
				(programList ?? programs.data.programs).map((program) => <ProgramForm key={program.id} program={program} canEdit={canEdit} onSaved={setProgramList} />)
			)}
		</>
	);
}

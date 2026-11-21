"use client";

import Link from "next/link";
import { useState, type FormEvent, type MouseEvent } from "react";
import { vuTru } from "@/config/vuTru";
import { api } from "../api";
import { useAdmin } from "../AdminProvider";
import { useLoader } from "../media/imageTools";
import { Alert, Button, errorText, fieldErrors, Loading, PageHeader, TextArea, TextField } from "../ui";
import { ConfirmDelete, Feedback, PictureField, PositionSelect, type Picture } from "./kit";
import { useRouter } from "next/navigation";

export type AreaRow = {
	id: string;
	slug: string;
	name: string;
	subtitle: string;
	coverMediaId: string | null;
	coverUrl: string;
	coverPosition: string;
	mapX: number | null;
	mapY: number | null;
	intro: string;
	contentHtml: string;
	visible: boolean;
	position: number;
	featured: boolean;
	featuredPosition: number;
	statueCount: number;
	version: number;
};

const round = (value: number) => Math.round(value * 10) / 10;

/** The temple map with the pins of every area; a click on the map moves the pin of the area being edited. */
export function PinPicker({ pins, currentId, x, y, onMove }: { pins: { id: string; name: string; x: number; y: number }[]; currentId: string; x: number | null; y: number | null; onMove: (x: number, y: number) => void }) {
	function click(event: MouseEvent<HTMLButtonElement>) {
		if (event.detail === 0) return; // a key press has no position: the numbers below are the keyboard way
		const box = event.currentTarget.getBoundingClientRect();
		const px = Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100));
		const py = Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100));
		onMove(round(px), round(py));
	}
	return (
		<div style={{ position: "relative", maxWidth: 720 }}>
			<button type="button" onClick={click} aria-label="Bản đồ chùa. Bấm vào bản đồ để đặt ghim của khu vực này" style={{ display: "block", width: "100%", padding: 0, border: "1px solid var(--tq-line)", background: "none", cursor: "crosshair" }}>
				<img src={vuTru.map.src} alt="" width={vuTru.map.width} height={vuTru.map.height} style={{ width: "100%", height: "auto", display: "block" }} />
			</button>
			{pins
				.filter((pin) => pin.id !== currentId)
				.map((pin) => (
					<span key={pin.id} title={pin.name} style={{ position: "absolute", left: `${pin.x}%`, top: `${pin.y}%`, width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: "50%", background: "#8a8a8a", border: "2px solid #fff", pointerEvents: "none" }} />
				))}
			{x !== null && y !== null ? (
				<span title="Ghim của khu vực này" style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 18, height: 18, marginLeft: -9, marginTop: -9, borderRadius: "50%", background: "var(--tq-accent)", border: "3px solid #fff", boxShadow: "0 0 0 1px var(--tq-accent)", pointerEvents: "none" }} />
			) : null}
		</div>
	);
}

export function AreaForm({ id }: { id: string }) {
	const router = useRouter();
	const { can } = useAdmin();
	const loaded = useLoader(() => api<AreaRow>("GET", `areas/${encodeURIComponent(id)}`), `area-${id}`);
	const all = useLoader(() => api<{ areas: AreaRow[] }>("GET", "areas"), "areas-all");
	const [row, setRow] = useState<AreaRow | null>(null);
	const [seen, setSeen] = useState<AreaRow | null>(null);
	const [form, setForm] = useState({ name: "", subtitle: "", intro: "", contentHtml: "", visible: true, position: "0", coverPosition: "center 50%", mapX: "", mapY: "" });
	const [cover, setCover] = useState<Picture | null>(null);
	const [busy, setBusy] = useState("");
	const [error, setError] = useState("");
	const [fields, setFields] = useState<Record<string, string>>({});
	const [notice, setNotice] = useState("");

	function seed(next: AreaRow) {
		setRow(next);
		setForm({ name: next.name, subtitle: next.subtitle, intro: next.intro, contentHtml: next.contentHtml, visible: next.visible, position: String(next.position), coverPosition: next.coverPosition, mapX: next.mapX === null ? "" : String(next.mapX), mapY: next.mapY === null ? "" : String(next.mapY) });
		setCover(next.coverMediaId ? { id: next.coverMediaId, url: next.coverUrl } : null);
	}
	if (loaded.data && loaded.data !== seen) {
		setSeen(loaded.data);
		seed(loaded.data);
	}

	const set = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
	const canEdit = can("areas", "update");
	const num = (value: string) => (value.trim() === "" ? null : Number(value));
	const x = num(form.mapX);
	const y = num(form.mapY);

	async function save(event: FormEvent) {
		event.preventDefault();
		if (!row) return;
		setBusy("save");
		setError("");
		setFields({});
		setNotice("");
		try {
			const saved = await api<AreaRow>("PATCH", `areas/${encodeURIComponent(id)}`, {
				version: row.version, name: form.name, subtitle: form.subtitle, intro: form.intro, contentHtml: form.contentHtml, visible: form.visible, position: Number(form.position) || 0,
				coverMediaId: cover?.id ?? null, coverPosition: form.coverPosition, mapX: x, mapY: y,
			});
			seed(saved);
			setNotice("Đã lưu khu vực.");
		} catch (caught) {
			setError(errorText(caught));
			setFields(fieldErrors(caught));
		} finally {
			setBusy("");
		}
	}

	async function remove() {
		setBusy("delete");
		try {
			await api("DELETE", `areas/${encodeURIComponent(id)}`);
			router.replace("/quan-tri/khu-vuc");
		} catch (caught) {
			setError(errorText(caught));
			setBusy("");
		}
	}

	const back = (
		<Link href="/quan-tri/khu-vuc" className="tq-back">
			← Khu vực
		</Link>
	);
	if (loaded.error && !row) {
		return (
			<>
				<PageHeader title="Khu vực" back={back} />
				<Alert kind="error">{loaded.error}</Alert>
				<Button variant="secondary" onClick={loaded.reload}>
					Thử lại
				</Button>
			</>
		);
	}
	if (!row) return <Loading />;
	const pins = (all.data?.areas ?? []).flatMap((area) => (area.mapX !== null && area.mapY !== null ? [{ id: area.id, name: area.name, x: area.mapX, y: area.mapY }] : []));

	return (
		<>
			<PageHeader title={`Sửa khu vực: ${row.name}`} back={back} />
			<form className="tq-panel" onSubmit={save} noValidate>
				<Feedback error={error} notice={notice} />
				<TextField label="Tên khu vực" value={form.name} onChange={(e) => set("name", e.target.value)} error={fields.name} required maxLength={160} disabled={!canEdit} />
				<TextField label="Tiêu đề phụ" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} error={fields.subtitle} maxLength={300} disabled={!canEdit} />
				<TextArea label="Giới thiệu ngắn" value={form.intro} onChange={(e) => set("intro", e.target.value)} error={fields.intro} disabled={!canEdit} />
				<TextArea label="Nội dung (HTML)" rows={10} value={form.contentHtml} onChange={(e) => set("contentHtml", e.target.value)} error={fields.contentHtml} disabled={!canEdit} hint="Chỉ giữ các thẻ p, br, strong, em, ul, ol, li, blockquote, h2–h4 và liên kết a (https hoặc trong site)." />
				<PictureField label="Ảnh bìa" value={cover} onChange={setCover} disabled={!canEdit} error={fields.coverMediaId} />
				<PositionSelect value={form.coverPosition} onChange={(value) => set("coverPosition", value)} />

				<fieldset className="tq-field" style={{ border: 0, padding: 0 }}>
					<legend className="tq-label">Ghim trên bản đồ chùa</legend>
					<p className="tq-hint">Bấm vào bản đồ để đặt ghim (chấm màu), hoặc nhập số phần trăm bên dưới. Chấm xám là ghim của các khu vực khác.</p>
					<PinPicker pins={pins} currentId={id} x={x} y={y} onMove={(px, py) => setForm((current) => ({ ...current, mapX: String(px), mapY: String(py) }))} />
					<div className="tq-toolbar" style={{ marginTop: 10 }}>
						<TextField label="Ngang (0–100 %)" type="number" min={0} max={100} step={0.1} value={form.mapX} onChange={(e) => set("mapX", e.target.value)} error={fields.mapX} disabled={!canEdit} />
						<TextField label="Dọc (0–100 %)" type="number" min={0} max={100} step={0.1} value={form.mapY} onChange={(e) => set("mapY", e.target.value)} error={fields.mapY} disabled={!canEdit} />
						{canEdit ? (
							<Button variant="secondary" onClick={() => setForm((current) => ({ ...current, mapX: "", mapY: "" }))}>
								Gỡ ghim
							</Button>
						) : null}
					</div>
				</fieldset>

				<label className="tq-check">
					<input type="checkbox" checked={form.visible} onChange={(e) => set("visible", e.target.checked)} disabled={!canEdit} />
					<span>Hiện trên trang công khai</span>
				</label>
				<TextField label="Thứ tự" type="number" min={0} value={form.position} onChange={(e) => set("position", e.target.value)} error={fields.position} disabled={!canEdit} />
				{canEdit ? (
					<Button type="submit" busy={busy === "save"}>
						Lưu khu vực
					</Button>
				) : null}
			</form>
			{can("areas", "delete") ? <ConfirmDelete what="khu vực" busy={busy === "delete"} onConfirm={() => void remove()} /> : null}
		</>
	);
}

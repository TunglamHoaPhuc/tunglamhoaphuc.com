"use client";

import { useState } from "react";
import { api } from "../api";
import { useAdmin } from "../AdminProvider";
import type { MediaItem } from "../media/imageTools";
import { useLoader } from "../media/imageTools";
import { MediaPicker } from "../media/MediaPicker";
import { Alert, Button, errorText, fieldErrors, Loading, PageHeader, TextArea, TextField } from "../ui";
import { LoadError, NoRight } from "./common";

type Seo = { title: string; description: string; ogMediaId: string | null; ogUrl: string; robotsExtra: string };

function Editor({ initial, onSaved }: { initial: Seo; onSaved: () => void }) {
	const { can } = useAdmin();
	const [form, setForm] = useState({ title: initial.title, description: initial.description, robotsExtra: initial.robotsExtra });
	const [picture, setPicture] = useState<{ id: string | null; url: string }>({ id: initial.ogMediaId, url: initial.ogUrl });
	const [picking, setPicking] = useState(false);
	const [busy, setBusy] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [result, setResult] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	const canEdit = can("seo", "update");

	async function save(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setErrors({});
		setResult(null);
		try {
			await api("PUT", "seo/defaults", { ...form, ogMediaId: picture.id });
			setResult({ kind: "success", text: "Đã lưu cài đặt SEO." });
			onSaved();
		} catch (caught) {
			setErrors(fieldErrors(caught));
			setResult({ kind: "error", text: errorText(caught) });
		} finally {
			setBusy(false);
		}
	}

	return (
		<form className="tq-panel" onSubmit={(e) => void save(e)} noValidate>
			<TextField label="Tiêu đề mặc định" value={form.title} maxLength={120} disabled={!canEdit} error={errors.title} hint="Dùng khi một trang không có tiêu đề SEO riêng. Nên dưới 60 ký tự." onChange={(e) => setForm({ ...form, title: e.target.value })} />
			<TextArea label="Mô tả mặc định" value={form.description} maxLength={300} disabled={!canEdit} error={errors.description} hint={`${form.description.length}/300 ký tự. Nên khoảng 150 ký tự.`} onChange={(e) => setForm({ ...form, description: e.target.value })} />

			<div className="tq-field">
				<span className="tq-label">Ảnh chia sẻ mặc định (Open Graph)</span>
				{picture.id ? (
					<div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
						{picture.url ? <img src={picture.url} alt="Ảnh chia sẻ đang chọn" style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid var(--tq-line)" }} /> : null}
						{canEdit ? <Button variant="secondary" onClick={() => setPicture({ id: null, url: "" })}>Bỏ ảnh</Button> : null}
					</div>
				) : (
					<p className="tq-muted" style={{ margin: 0 }}>Chưa chọn ảnh.</p>
				)}
				{errors.ogMediaId ? <p className="tq-field-error">{errors.ogMediaId}</p> : null}
				{canEdit ? (
					<p>
						<Button variant="secondary" onClick={() => setPicking((v) => !v)}>{picking ? "Đóng thư viện" : "Chọn ảnh từ thư viện"}</Button>
					</p>
				) : null}
			</div>
			{picking ? (
				<MediaPicker
					onPick={(item: MediaItem) => {
						setPicture({ id: item.id, url: item.url });
						setPicking(false);
					}}
					onCancel={() => setPicking(false)}
				/>
			) : null}

			<TextArea
				label="Thêm vào robots.txt"
				rows={5}
				value={form.robotsExtra}
				disabled={!canEdit}
				error={errors.robotsExtra}
				hint='Mỗi dòng một quy tắc, dạng "Disallow: /duong-dan" hoặc "Allow: /duong-dan". Chỉ áp dụng cho trang công khai.'
				onChange={(e) => setForm({ ...form, robotsExtra: e.target.value })}
				style={{ fontFamily: "ui-monospace, monospace" }}
			/>

			{result ? <Alert kind={result.kind}>{result.text}</Alert> : null}
			{canEdit ? (
				<button type="submit" className="tq-btn tq-btn--primary" disabled={busy} aria-busy={busy || undefined}>
					{busy ? "Đang lưu…" : "Lưu"}
				</button>
			) : (
				<Alert kind="info">Bạn chỉ có quyền xem phần này.</Alert>
			)}
		</form>
	);
}

export function SeoForm() {
	const { can } = useAdmin();
	const load = useLoader(() => api<Seo>("GET", "seo/defaults"), "seo");
	if (!can("seo", "view")) return <NoRight />;
	return (
		<>
			<PageHeader title="SEO" />
			<p className="tq-muted">Thông tin mặc định cho công cụ tìm kiếm và khi chia sẻ link. Meta riêng của từng bài nằm ngay trong form của bài đó.</p>
			{load.error ? <LoadError error={load.error} onRetry={load.reload} /> : !load.data ? <Loading /> : <Editor initial={load.data} onSaved={load.reload} />}
		</>
	);
}

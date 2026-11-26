"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ApiClientError } from "../api";
import { useAdmin } from "../AdminProvider";
import { Alert, errorText } from "../ui";
import { appendVariants, postForm, prepareImage, type MediaItem } from "./imageTools";

type Status = "waiting" | "preparing" | "uploading" | "done" | "duplicate" | "error";
type Row = { key: number; name: string; status: Status; message: string; duplicateId?: string };

const PARALLEL = 3;
const STATUS_TEXT: Record<Status, string> = { waiting: "đang chờ", preparing: "đang chuẩn bị", uploading: "đang tải", done: "xong", duplicate: "ảnh đã có", error: "lỗi" };

let rowKey = 0;

/** Drag-and-drop or choose pictures; at most three go up at once, each with its own status line. */
export function UploadZone({ folderId, onDone, onUseExisting }: { folderId: string | null; onDone: () => void; onUseExisting?: (id: string) => void }) {
	const { can } = useAdmin();
	const inputId = useId();
	const alive = useRef(true);
	const [rows, setRows] = useState<Row[]>([]);
	const [busy, setBusy] = useState(false);
	const [over, setOver] = useState(false);

	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);

	if (!can("media", "create")) return null;

	const patch = (key: number, change: Partial<Row>) => {
		if (alive.current) setRows((old) => old.map((row) => (row.key === key ? { ...row, ...change } : row)));
	};

	async function processOne(key: number, file: File): Promise<boolean> {
		patch(key, { status: "preparing" });
		try {
			const prepared = await prepareImage(file);
			patch(key, { status: "uploading" });
			const form = new FormData();
			form.append("file", prepared.blob, prepared.name);
			await appendVariants(form, file, { width: prepared.width, height: prepared.height, bytes: prepared.blob.size });
			if (folderId) form.append("folderId", folderId);
			await postForm<MediaItem>("POST", "media", form);
			patch(key, { status: "done", message: "" });
			return true;
		} catch (caught) {
			if (caught instanceof ApiClientError && caught.code === "duplicate") patch(key, { status: "duplicate", message: caught.message, duplicateId: caught.fields?.id });
			else patch(key, { status: "error", message: errorText(caught) });
			return false;
		}
	}

	async function run(files: File[]) {
		if (busy || files.length === 0) return;
		const entries = files.map((file) => ({ key: ++rowKey, file }));
		setRows((old) => [...entries.map(({ key, file }): Row => ({ key, name: file.name, status: "waiting", message: "" })), ...old]);
		setBusy(true);
		let next = 0;
		let uploaded = 0;
		try {
			const worker = async () => {
				while (next < entries.length) {
					const entry = entries[next++];
					if (await processOne(entry.key, entry.file)) uploaded++;
				}
			};
			await Promise.all(Array.from({ length: Math.min(PARALLEL, entries.length) }, worker));
		} finally {
			if (alive.current) setBusy(false);
		}
		if (alive.current && uploaded > 0) onDone();
	}

	function onChoose(event: ChangeEvent<HTMLInputElement>) {
		const files = Array.from(event.target.files ?? []);
		event.target.value = "";
		void run(files);
	}

	function onDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setOver(false);
		void run(Array.from(event.dataTransfer.files));
	}

	return (
		<div>
			<div
				onDragOver={(event) => {
					event.preventDefault();
					setOver(true);
				}}
				onDragLeave={() => setOver(false)}
				onDrop={onDrop}
				style={{
					border: "2px dashed var(--tq-line)",
					borderRadius: "var(--tq-radius)",
					padding: 16,
					background: over ? "var(--tq-accent-soft)" : "var(--tq-card)",
				}}
			>
				<p style={{ margin: "0 0 8px" }}>Kéo thả ảnh vào đây, hoặc chọn từ máy.</p>
				<label htmlFor={inputId} className="tq-label">Chọn ảnh để tải lên (JPEG, PNG, WebP, GIF; tối đa 15 MB mỗi ảnh)</label>
				<input id={inputId} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={onChoose} disabled={busy} />
				<p className="tq-hint" style={{ margin: "8px 0 0" }}>
					Ảnh lớn được thu nhỏ về tối đa 2560 px ở cạnh dài trước khi tải. {folderId ? "Ảnh mới vào thư mục đang chọn." : "Ảnh mới chưa thuộc thư mục nào."}
				</p>
			</div>

			{rows.length ? (
				<div style={{ marginTop: 10 }}>
					<ul aria-label="Tiến trình tải ảnh" aria-live="polite" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
						{rows.map((row) => (
							<li key={row.key} style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "center" }}>
								<span style={{ wordBreak: "break-all" }}>{row.name}</span>
								<span className={`tq-badge ${row.status === "done" ? "tq-badge--ok" : row.status === "error" ? "tq-badge--danger" : row.status === "duplicate" ? "tq-badge--warn" : ""}`}>
									{STATUS_TEXT[row.status]}
								</span>
								{row.message ? <span className="tq-muted">{row.message}</span> : null}
								{row.status === "duplicate" && row.duplicateId && onUseExisting ? (
									<button type="button" className="tq-btn tq-btn--link tq-btn--small" onClick={() => onUseExisting(row.duplicateId as string)}>
										Dùng ảnh có sẵn
									</button>
								) : null}
							</li>
						))}
					</ul>
					{!busy ? (
						<button type="button" className="tq-btn tq-btn--link tq-btn--small" onClick={() => setRows([])}>
							Xóa danh sách
						</button>
					) : null}
				</div>
			) : null}
			{busy ? <Alert kind="info">Đang tải ảnh lên, xin đừng đóng trang.</Alert> : null}
		</div>
	);
}
